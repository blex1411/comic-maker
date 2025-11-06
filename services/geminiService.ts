import { GoogleGenAI, Type, Modality, GenerateContentResponse, Chat, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Character, Panel, Storybook } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const dialogueSchema = {
    type: Type.OBJECT,
    properties: {
        character: { 
            type: Type.STRING,
            description: "Placeholder untuk karakter yang berbicara (misal: '[CHARACTER_1]', '[CHARACTER_2]'). JANGAN gunakan nama karakter, gunakan placeholder yang sesuai."
        },
        speech_text: {
            type: Type.STRING,
            description: "Teks dialog yang diucapkan oleh karakter. Harus dalam Bahasa Indonesia."
        },
        type: {
            type: Type.STRING,
            enum: ["dialogue", "monologue"],
            description: "Jenis teks. 'dialogue' untuk ucapan yang diucapkan, 'monologue' untuk pikiran internal karakter (akan ditampilkan dalam gelembung putus-putus)."
        }
    },
    required: ["character", "speech_text", "type"]
};

const textOverlaySchema = {
    type: Type.OBJECT,
    properties: {
        text: {
            type: Type.STRING,
            description: "Teks yang akan ditampilkan sebagai overlay, seperti poin plot penting atau efek suara. Harus dalam Bahasa Indonesia."
        },
        style: {
            type: Type.STRING,
            enum: ["caption", "onomatopoeia"],
            description: "Gaya teks. 'caption' untuk kotak narasi di dalam gambar, 'onomatopoeia' untuk efek suara seperti 'BLAM!'."
        }
    },
    required: ["text", "style"]
};

const storySchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      panel_number: { type: Type.INTEGER },
      narrative_text: { 
        type: Type.STRING, 
        description: "Teks narasi singkat (seperti suara narator) untuk panel komik ini. Ditampilkan di luar gambar. Harus dalam Bahasa Indonesia." 
      },
      visual_description: { 
        type: Type.STRING, 
        description: "Deskripsi visual detail untuk AI gambar. Gunakan tag [CHARACTER_1], [CHARACTER_2], dll. Jelaskan adegan, aksi, dan emosi. Contoh: '[CHARACTER_1] melompati gedung, sementara [CHARACTER_2] melihat dari bawah dengan kaget.' Pastikan deskripsi ini dalam Bahasa Indonesia." 
      },
      dialogues: {
          type: Type.ARRAY,
          items: dialogueSchema,
          description: "Array berisi dialog yang diucapkan oleh karakter dalam panel ini. HANYA sertakan jika ada dialog dalam cerita."
      },
      text_overlays: {
          type: Type.ARRAY,
          items: textOverlaySchema,
          description: "Array berisi teks penting atau efek suara untuk ditampilkan DI DALAM gambar. HANYA sertakan jika diperlukan oleh cerita."
      }
    },
    required: ["panel_number", "narrative_text", "visual_description"],
  },
};

export const generateStoryScript = async (prompt: string, characters: Character[]): Promise<Panel[]> => {
    const characterDescriptions = characters.map((char, i) => `${char.name} (direpresentasikan sebagai [CHARACTER_${i + 1}])`).join(', ');
    
    const fullPrompt = `
      Ide Cerita Komik: "${prompt}"

      Karakter yang Tersedia: ${characters.length > 0 ? characterDescriptions : 'Tidak ada'}.

      Instruksi:
      1. Buat skrip komik 4 panel berdasarkan ide cerita.
      2. Seluruh output HARUS dalam Bahasa Indonesia.
      3. Untuk setiap panel, berikan 'narrative_text' (narasi eksternal).
      4. Untuk setiap panel, berikan 'visual_description' (untuk AI gambar). Gunakan placeholder karakter (misal: "[CHARACTER_1]") saat merujuk pada karakter.
      5. Jika karakter berbicara atau berpikir, tambahkan objek 'dialogues'. Setiap dialog HARUS menggunakan placeholder karakter (misal: "[CHARACTER_1]") untuk properti 'character' dan tentukan 'type' sebagai 'dialogue' untuk ucapan atau 'monologue' untuk pikiran.
      6. Jika ada poin plot penting atau efek suara (misal: "Sementara itu...", "BOOM!"), tambahkan objek 'text_overlays'.
      7. JANGAN membuat dialog atau overlay jika tidak relevan dengan ide cerita.
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: fullPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: storySchema,
        },
    });

    try {
        const jsonText = response.text.trim();
        const panels = JSON.parse(jsonText);
        return panels;
    } catch (e) {
        console.error("Gagal mem-parsing JSON skrip cerita:", e);
        throw new Error("AI memberikan format cerita yang tidak valid. Silakan coba lagi.");
    }
};

export const generatePanelImage = async (panel: Panel, characters: Character[]): Promise<string> => {
    const parts: any[] = [];
    
    const characterMap: { [key: string]: Character } = {};
    characters.forEach((char, index) => {
        characterMap[`[CHARACTER_${index + 1}]`] = char;
    });

    const addedCharacters = new Set<string>();
    const characterReferences = new Set<string>();

    // Combine descriptions to find all unique character references
    let combinedText = panel.visual_description;
    if (panel.dialogues) {
      panel.dialogues.forEach(d => combinedText += ` ${d.character}`);
    }
    
    const regex = /\[CHARACTER_(\d+)\]/g;
    let match;
    while ((match = regex.exec(combinedText)) !== null) {
      const charTag = `[CHARACTER_${match[1]}]`;
      characterReferences.add(charTag);
    }

    // Add character images to parts and build instructions
    let characterInstructions = '';
    if (characterReferences.size > 0) {
        characterInstructions = "\n\nInstruksi Karakter (ATURAN PALING PENTING - WAJIB DIIKUTI):";
        characterReferences.forEach(charTag => {
            const character = characterMap[charTag];
            if (character) {
                // Add image if not already added
                if (!addedCharacters.has(character.id)) {
                    parts.push({
                        inlineData: {
                            mimeType: character.mimeType,
                            data: character.base64,
                        },
                    });
                    addedCharacters.add(character.id);
                }

                // Build new, stronger instruction string
                characterInstructions += `\n- Untuk ${charTag}: Detail karakter HARUS selalu menggunakan gambar referensi dan deskripsi karakter yang diberikan. JANGAN PERNAH merubah, menghapus, atau menambahkan detail karakter (aksesoris, pakaian, wajah), KECUALI jika 'Deskripsi Adegan' secara eksplisit memintanya (misalnya, 'Deskripsi Adegan' menyebutkan '${character.name} sekarang memakai kacamata'). Jika tidak ada instruksi perubahan, penampilan karakter HARUS SAMA PERSIS dengan referensi.`;
            }
        });
    }
    
    // Build character comparison instructions if multiple characters are present
    let comparisonInstructions = '';
    if (characterReferences.size > 1) {
        let descriptionsAvailable = false;
        let comparisonText = "\n\nPerbandingan Karakter (SANGAT PENTING):";
        characterReferences.forEach(charTag => {
            const character = characterMap[charTag];
            if (character && character.description) {
                descriptionsAvailable = true;
                comparisonText += `\n- ${charTag} (${character.name}): ${character.description}`;
            }
        });

        if (descriptionsAvailable) {
            comparisonText += "\n\nPatuhi deskripsi di atas untuk memastikan perbandingan antar karakter (seperti tinggi badan, bentuk tubuh) akurat dan konsisten dalam gambar.";
            comparisonInstructions = comparisonText;
        }
    }

    let imagePrompt = `Tugas: Buat gambar panel komik BARU. JANGAN mengedit gambar referensi yang diberikan.
Gaya: panel buku komik yang dinamis dan bersemangat.
PENTING: Rasio aspek gambar HARUS 9:16 vertikal (tinggi). Patuhi rasio aspek ini dengan ketat.${characterInstructions}${comparisonInstructions}
Deskripsi Adegan: ${panel.visual_description}`;

    if (panel.text_overlays && panel.text_overlays.length > 0) {
        imagePrompt += "\n\nInstruksi Teks Tambahan:";
        panel.text_overlays.forEach(overlay => {
            if (overlay.style === 'caption') {
                 imagePrompt += `\n- Tambahkan kotak teks narasi (caption box) dengan teks: "${overlay.text}".`;
            } else { // onomatopoeia
                 imagePrompt += `\n- Tambahkan efek suara teks besar dan bergaya (onomatopoeia) "${overlay.text}" secara dramatis di dalam adegan.`;
            }
        });
    } else if (!characterInstructions && !comparisonInstructions) { 
        imagePrompt += "\n\nInstruksi Penting: Gambar harus dibuat tanpa teks, gelembung ucapan, atau kotak narasi apa pun.";
    }

    parts.push({ text: imagePrompt });

    if (addedCharacters.size === 0 && characters.length > 0 && /\[CHARACTER_\d+\]/.test(combinedText)) {
        throw new Error(`Panel ${panel.panel_number} merujuk pada karakter, tetapi gambar karakter yang sesuai tidak dapat ditemukan. Pastikan deskripsi Anda menggunakan placeholder yang benar.`);
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts },
      config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
          ],
      },
    });
    
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (imagePart && imagePart.inlineData) {
      const base64ImageBytes: string = imagePart.inlineData.data;
      const mimeType = imagePart.inlineData.mimeType;
      return `data:${mimeType};base64,${base64ImageBytes}`;
    }
    
    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    if (textPart && textPart.text) {
        console.error("Image generation failed with text response:", textPart.text);
        throw new Error(`Gagal membuat gambar untuk panel ${panel.panel_number}. Model merespons dengan teks: ${textPart.text}`);
    }

    throw new Error(`Gagal membuat gambar untuk panel ${panel.panel_number}. Tidak ada gambar yang dikembalikan.`);
};

export const generateCharacterDescription = async (characterImage: { base64: string; mimeType: string }): Promise<string> => {
    const imagePart = {
        inlineData: {
            mimeType: characterImage.mimeType,
            data: characterImage.base64,
        },
    };

    const textPart = {
        text: "Analisis gambar karakter ini dan berikan deskripsi ringkas untuk seorang seniman komik. Fokus pada: jenis kelamin, gaya dan warna rambut, pakaian, dan ciri khas apa pun (misalnya, bekas luka, aksesori).",
    };

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
            systemInstruction: "Anda adalah asisten penulis ahli yang membuat deskripsi karakter yang jelas dan ringkas untuk seniman komik. Semua respons harus dalam Bahasa Indonesia.",
        }
    });

    const description = response.text;
    if (description) {
        return description.trim();
    }

    throw new Error("Gagal menghasilkan deskripsi karakter. Model tidak memberikan respons teks.");
};


export const createChat = (): Chat => {
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: 'Kamu adalah asisten kreatif yang membantu pengguna mengembangkan ide cerita komik. Berinteraksilah dalam Bahasa Indonesia. Berikan ide-ide yang menarik dan bantu pengguna membangun alur cerita, dialog karakter, dan deskripsi visual.',
        },
    });
};

// --- IndexedDB Service for Storybooks ---

const DB_NAME = 'ComicCraftDB';
const DB_VERSION = 1;
const STORYBOOK_STORE = 'storybooks';

let db: IDBDatabase;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Database error:', request.error);
      reject('Error opening IndexedDB. Your browser might be in private mode or block it.');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORYBOOK_STORE)) {
        dbInstance.createObjectStore(STORYBOOK_STORE, { keyPath: 'id' });
      }
    };
  });
};

export const saveStorybooks = async (data: Storybook[]): Promise<void> => {
  const dbInstance = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(STORYBOOK_STORE, 'readwrite');
    const store = transaction.objectStore(STORYBOOK_STORE);

    const clearRequest = store.clear();
    clearRequest.onerror = () => reject(transaction.error);
    clearRequest.onsuccess = () => {
      if (data.length > 0) {
        data.forEach(item => {
            store.put(item);
        });
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
        console.error(`Error saving data to ${STORYBOOK_STORE}:`, transaction.error);
        reject(`Error saving data to ${STORYBOOK_STORE}.`);
    };
  });
};

export const loadStorybooks = async (): Promise<Storybook[]> => {
  const dbInstance = await initDB();
  return new Promise((resolve, reject) => {
    if (!dbInstance.objectStoreNames.contains(STORYBOOK_STORE)) {
        return resolve([]);
    }
    const transaction = dbInstance.transaction(STORYBOOK_STORE, 'readonly');
    const store = transaction.objectStore(STORYBOOK_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as Storybook[]);
    };

    request.onerror = () => {
      console.error(`Error loading data from ${STORYBOOK_STORE}:`, request.error);
      reject(`Error loading data from ${STORYBOOK_STORE}.`);
    };
  });
};