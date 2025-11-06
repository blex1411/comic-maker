import React, { useState, useEffect, useRef } from 'react';
import { Character, Panel, ChatMessage, Storybook, Dialogue } from './types';
import { generateStoryScript, generatePanelImage, createChat, loadStorybooks, saveStorybooks } from './services/geminiService';
import { CharacterUploader } from './components/CharacterUploader';
import { StoryBuilder } from './components/StoryPrompt';
import { ComicDisplay } from './components/ComicDisplay';
import { Header } from './components/Header';
import { LoadingSpinner } from './components/LoadingSpinner';
import { StorybookManager } from './components/StorybookManager';
import { Chat } from '@google/genai';
import { PlusIcon } from './components/icons/PlusIcon';
import { DownloadIcon } from './components/icons/DownloadIcon';

// Helper untuk mengubah base64 menjadi objek File
const base64ToFile = (base64: string, id: string, mimeType: string): File => {
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });
    // Coba dapatkan nama file asli dari ID
    const fileName = id.split(/-\d+$/)[0] || 'character.img'; 
    return new File([blob], fileName, { type: mimeType });
};

// Tipe untuk data karakter yang dapat disimpan, tidak termasuk objek File yang tidak dapat diserialisasi
type StorableCharacter = Omit<Character, 'file'>;

const App: React.FC = () => {
  // --- INISIALISASI STATE DARI LOCALSTORAGE (HANYA UNTUK KARAKTER) ---

  const [characters, setCharacters] = useState<Character[]>(() => {
    try {
      const saved = window.localStorage.getItem('comic-craft-characters');
      if (!saved) return [];
      const storableChars: StorableCharacter[] = JSON.parse(saved);
      return storableChars.map(char => ({
        ...char,
        file: base64ToFile(char.base64, char.id, char.mimeType),
      }));
    } catch (error) {
      console.error("Gagal memuat karakter dari localStorage:", error);
      return [];
    }
  });

  // Storybook sekarang dimuat secara asinkron dari IndexedDB
  const [storybooks, setStorybooks] = useState<Storybook[]>([]);
  const [areStorybooksLoaded, setAreStorybooksLoaded] = useState(false);


  // --- STATE YANG TIDAK PERSISTEN ---
  const [prompt, setPrompt] = useState<string>('');
  const [panels, setPanels] = useState<Panel[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  
  // --- STATE LAINNYA ---
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStorybook, setSelectedStorybook] = useState<Storybook | null>(null);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [loadingPanelId, setLoadingPanelId] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const chatRef = useRef<Chat | null>(null);
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const setPanelRef = (id: string, el: HTMLDivElement | null) => {
    panelRefs.current[id] = el;
  };


  // --- EFEK PERSISTENSI LOCALSTORAGE (HANYA UNTUK KARAKTER) ---

  useEffect(() => {
    try {
      const storableChars: StorableCharacter[] = characters.map(({ file, ...rest }) => rest);
      window.localStorage.setItem('comic-craft-characters', JSON.stringify(storableChars));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
          setError("Gagal menyimpan karakter: Penyimpanan lokal penuh. Coba hapus beberapa karakter atau storybook.");
      } else {
          console.error("Gagal menyimpan karakter ke localStorage:", err);
      }
    }
  }, [characters]);

  // --- Muat dan Simpan Storybook menggunakan IndexedDB ---
  useEffect(() => {
    const load = async () => {
        try {
            const loadedStorybooks = await loadStorybooks();
            setStorybooks(loadedStorybooks);
        } catch (err) {
            console.error("Gagal memuat storybooks dari IndexedDB:", err);
            setError("Tidak dapat memuat storybook yang tersimpan.");
        } finally {
            setAreStorybooksLoaded(true);
        }
    };
    load();
  }, []);
  
  useEffect(() => {
    if (!areStorybooksLoaded) return; // Jangan simpan sebelum pemuatan awal selesai

    const save = async () => {
        try {
            await saveStorybooks(storybooks);
        } catch (err) {
            console.error("Gagal menyimpan storybooks ke IndexedDB:", err);
            setError("Gagal menyimpan storybook. Browser Anda mungkin kehabisan ruang atau menonaktifkan penyimpanan.");
        }
    };
    save();
  }, [storybooks, areStorybooksLoaded]);


  // --- INISIALISASI CHAT ---
  useEffect(() => {
    chatRef.current = createChat();
    setChatHistory([{
        role: 'model',
        text: 'Halo! Saya asisten cerita AI Anda. Ceritakan ide Anda, atau tanyakan apa saja untuk memulai membuat komik!'
    }]);
  }, []);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !chatRef.current) return;

    const userMessage: ChatMessage = { role: 'user', text: chatInput };
    setChatHistory(prev => [...prev, userMessage]);
    const currentChatInput = chatInput;
    setChatInput('');
    setIsChatLoading(true);

    try {
        const response = await chatRef.current.sendMessage({ message: currentChatInput });
        const modelMessage: ChatMessage = { role: 'model', text: response.text };
        setChatHistory(prev => [...prev, modelMessage]);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan pada chat.';
        setChatHistory(prev => [...prev, { role: 'model', text: `Maaf, terjadi kesalahan: ${errorMessage}` }]);
    } finally {
        setIsChatLoading(false);
    }
  };
  
  const handleRefreshChat = () => {
    chatRef.current = createChat();
    const initialMessage: ChatMessage = {
        role: 'model',
        text: 'Halo! Saya asisten cerita AI Anda. Ceritakan ide Anda, atau tanyakan apa saja untuk memulai membuat komik!'
    };
    setChatHistory([initialMessage]);
    setChatInput('');
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    setPanels([]);
    setSelectedStorybook(null);

    try {
      const scriptPanels = await generateStoryScript(prompt, characters);
      const panelsWithInitialPositions = scriptPanels.map((panel, index) => ({
        ...panel,
        id: `gen-${Date.now()}-${index}`, // Tambahkan ID unik
        dialogues: panel.dialogues?.map((dialogue, dIndex) => {
          const bubbleY = 10 + dIndex * 20;
          const bubbleX = (dIndex % 2 === 0) ? 5 : 65;
          return {
            ...dialogue,
            type: dialogue.type || 'dialogue',
            fontSize: dialogue.fontSize || 1,
            fontFamily: "'Comic Neue', cursive",
            position: { x: bubbleX, y: bubbleY },
            tailPosition: { x: bubbleX + 15, y: bubbleY + 15 },
            size: { width: 30, height: 15 }
          }
        })
      }));
      setPanels(panelsWithInitialPositions);

      const updatedPanels = await Promise.all(
        panelsWithInitialPositions.map(async (panel) => {
          try {
            setLoadingPanelId(panel.id);
            const imageUrl = await generatePanelImage(panel, characters);
            setLoadingPanelId(null);
            return { ...panel, imageUrl };
          } catch (imageError) {
            console.error(`Gagal membuat gambar untuk panel ${panel.panel_number}:`, imageError);
            setLoadingPanelId(null);
            return panel;
          }
        })
      );
      setPanels(updatedPanels);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui saat membuat skrip.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePanelUpdate = async (updatedPanel: Panel, skipRegeneration?: boolean) => {
    if (skipRegeneration) {
        setPanels(currentPanels =>
            currentPanels.map(p => (p.id === updatedPanel.id ? updatedPanel : p))
        );
        return;
    }

    const originalPanel = panels.find(p => p.id === updatedPanel.id);
    if (!originalPanel) return;
    
    setLoadingPanelId(updatedPanel.id);
    setPanels(currentPanels => 
        currentPanels.map(p => 
            p.id === updatedPanel.id
                ? { ...updatedPanel, imageUrl: p.imageUrl } // Keep old image during load
                : p
        )
    );

    try {
        const newImageUrl = await generatePanelImage(updatedPanel, characters);
        setPanels(currentPanels => 
            currentPanels.map(p => 
                p.id === updatedPanel.id
                    ? { ...updatedPanel, imageUrl: newImageUrl } 
                    : p
            )
        );
    } catch (imageError) {
        const errorMessage = imageError instanceof Error ? imageError.message : 'Unknown error';
        console.error(`Gagal membuat ulang gambar untuk panel ${updatedPanel.panel_number}:`, imageError);
        
        let displayError = `Gagal membuat ulang gambar untuk panel ${updatedPanel.panel_number}.`;
        if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
            displayError += " Anda telah melebihi kuota API Anda. Silakan periksa paket dan detail penagihan Anda.";
        } else {
            displayError += ` Kesalahan: ${errorMessage}`;
        }
        setError(displayError);
        
        setPanels(currentPanels => 
            currentPanels.map(p => 
                p.id === updatedPanel.id
                    ? originalPanel
                    : p
            )
        );
    } finally {
        setLoadingPanelId(null);
    }
  };

  const handleDialogueUpdate = (panelId: string, dialogueIndex: number, updatedDialogue: Dialogue) => {
    setPanels(currentPanels =>
        currentPanels.map(p => {
            if (p.id === panelId) {
                const newDialogues = [...(p.dialogues || [])];
                if (newDialogues[dialogueIndex]) {
                    newDialogues[dialogueIndex] = updatedDialogue;
                }
                return { ...p, dialogues: newDialogues };
            }
            return p;
        })
    );
  };

  const handleAddDialogue = (panelId: string) => {
    setPanels(currentPanels =>
        currentPanels.map(p => {
            if (p.id === panelId) {
                const existingDialogues = p.dialogues || [];
                const newDialogue: Dialogue = {
                    character: '[BARU]',
                    speech_text: 'Teks baru...',
                    type: 'dialogue',
                    fontSize: 1,
                    fontFamily: "'Comic Neue', cursive",
                    position: { x: 25, y: 70 },
                    tailPosition: { x: 50, y: 95 },
                    size: { width: 50, height: 20 }
                };
                return { ...p, dialogues: [...existingDialogues, newDialogue] };
            }
            return p;
        })
    );
  };
  
  const handleDialogueDelete = (panelId: string, dialogueIndex: number) => {
    setPanels(currentPanels =>
      currentPanels.map(p => {
        if (p.id === panelId) {
          const newDialogues = [...(p.dialogues || [])];
          newDialogues.splice(dialogueIndex, 1);
          return { ...p, dialogues: newDialogues };
        }
        return p;
      })
    );
  };

  // --- HANDLER UNTUK STORYBOOK ---
  const handleStorybookPanelUpdate = async (updatedPanel: Panel, skipRegeneration?: boolean) => {
    if (!selectedStorybook) return;
    const storybookId = selectedStorybook.id;

    if (skipRegeneration) {
        setStorybooks(currentStorybooks =>
            currentStorybooks.map(sb =>
                sb.id === storybookId
                    ? { ...sb, panels: sb.panels.map(p => p.id === updatedPanel.id ? updatedPanel : p) }
                    : sb
            )
        );
        return;
    }

    const originalPanelInStorybook = storybooks
        .find(sb => sb.id === storybookId)?.panels
        .find(p => p.id === updatedPanel.id);
    
    setLoadingPanelId(updatedPanel.id);
    setStorybooks(currentStorybooks =>
      currentStorybooks.map(sb =>
        sb.id === storybookId
          ? { ...sb, panels: sb.panels.map(p => p.id === updatedPanel.id ? { ...updatedPanel, imageUrl: p.imageUrl } : p) }
          : sb
      )
    );

    try {
      const newImageUrl = await generatePanelImage(updatedPanel, characters);
      setStorybooks(currentStorybooks =>
        currentStorybooks.map(sb =>
          sb.id === storybookId
            ? { ...sb, panels: sb.panels.map(p => p.id === updatedPanel.id ? { ...updatedPanel, imageUrl: newImageUrl } : p) }
            : sb
        )
      );
    } catch (imageError) {
      const errorMessage = imageError instanceof Error ? imageError.message : 'Unknown error';
      console.error(`Gagal membuat ulang gambar untuk panel storybook:`, imageError);
      
      let displayError = `Gagal membuat ulang gambar untuk panel.`;
        if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
            displayError += " Anda telah melebihi kuota API Anda. Silakan periksa paket dan detail penagihan Anda.";
        } else {
            displayError += ` Kesalahan: ${errorMessage}`;
        }
      setError(displayError);

      setStorybooks(currentStorybooks =>
        currentStorybooks.map(sb =>
          sb.id === storybookId
            ? { ...sb, panels: sb.panels.map(p => p.id === updatedPanel.id ? (originalPanelInStorybook || updatedPanel) : p) }
            : sb
        )
      );
    } finally {
        setLoadingPanelId(null);
    }
  };

  const handleStorybookDialogueUpdate = (panelId: string, dialogueIndex: number, updatedDialogue: Dialogue) => {
    setStorybooks(currentStorybooks =>
      currentStorybooks.map(sb => {
        if (sb.id !== selectedStorybook?.id) return sb;
        return {
          ...sb,
          panels: sb.panels.map(p => {
            if (p.id === panelId) {
              const newDialogues = [...(p.dialogues || [])];
              if (newDialogues[dialogueIndex]) newDialogues[dialogueIndex] = updatedDialogue;
              return { ...p, dialogues: newDialogues };
            }
            return p;
          })
        };
      })
    );
  };

  const handleStorybookAddDialogue = (panelId: string) => {
    setStorybooks(currentStorybooks =>
      currentStorybooks.map(sb => {
        if (sb.id !== selectedStorybook?.id) return sb;
        return {
          ...sb,
          panels: sb.panels.map(p => {
            if (p.id === panelId) {
              const newDialogue: Dialogue = {
                character: '[BARU]',
                speech_text: 'Teks baru...',
                type: 'dialogue',
                fontSize: 1,
                fontFamily: "'Comic Neue', cursive",
                position: { x: 25, y: 70 },
                tailPosition: { x: 50, y: 95 },
                size: { width: 50, height: 20 }
              };
              return { ...p, dialogues: [...(p.dialogues || []), newDialogue] };
            }
            return p;
          })
        };
      })
    );
  };

  const handleStorybookDialogueDelete = (panelId: string, dialogueIndex: number) => {
    setStorybooks(currentStorybooks =>
      currentStorybooks.map(sb => {
        if (sb.id !== selectedStorybook?.id) return sb;
        return {
          ...sb,
          panels: sb.panels.map(p => {
            if (p.id === panelId) {
              const newDialogues = [...(p.dialogues || [])];
              newDialogues.splice(dialogueIndex, 1);
              return { ...p, dialogues: newDialogues };
            }
            return p;
          })
        };
      })
    );
  };
  
    const handleDeletePanelFromStorybook = (panelId: string) => {
        if (!selectedStorybook) return;
        setStorybooks(currentStorybooks =>
            currentStorybooks.map(sb =>
                sb.id === selectedStorybook.id
                    ? { ...sb, panels: sb.panels.filter(p => p.id !== panelId) }
                    : sb
            )
        );
    };

    const handleReorderStorybookPanels = (draggedPanelId: string, targetPanelId: string) => {
        if (!selectedStorybook || draggedPanelId === targetPanelId) return;
        setStorybooks(currentStorybooks =>
            currentStorybooks.map(sb => {
                if (sb.id !== selectedStorybook.id) return sb;

                const panels = [...sb.panels];
                const dragIndex = panels.findIndex(p => p.id === draggedPanelId);
                const targetIndex = panels.findIndex(p => p.id === targetPanelId);

                if (dragIndex === -1 || targetIndex === -1) return sb;

                const [draggedItem] = panels.splice(dragIndex, 1);
                panels.splice(targetIndex, 0, draggedItem);

                const renumberedPanels = panels.map((panel, index) => ({
                    ...panel,
                    panel_number: index + 1
                }));

                return { ...sb, panels: renumberedPanels };
            })
        );
    };

    const handleCreateNewPanelInStorybook = () => {
        if (!selectedStorybook) return;
        setStorybooks(currentStorybooks =>
            currentStorybooks.map(sb => {
                if (sb.id !== selectedStorybook.id) return sb;

                const newPanel: Panel = {
                    id: `sb-new-${Date.now()}`,
                    panel_number: sb.panels.length + 1,
                    narrative_text: 'Narasi baru...',
                    visual_description: 'Tulis deskripsi visual di sini untuk membuat gambar panel.',
                    dialogues: [],
                    imageUrl: undefined,
                };

                return { ...sb, panels: [...sb.panels, newPanel] };
            })
        );
    };

  const handleCreateStorybook = (name: string) => {
    const newStorybook: Storybook = {
      id: `storybook-${Date.now()}`,
      name,
      panels: [],
    };
    setStorybooks(prev => [...prev, newStorybook]);
  };
  
  const handleDeleteStorybook = (storybookId: string) => {
    if (selectedStorybook?.id === storybookId) {
      setSelectedStorybook(null);
    }
    setStorybooks(prev => prev.filter(sb => sb.id !== storybookId));
  };

  const handleUpdateStorybookName = (storybookId: string, newName: string) => {
    setStorybooks(prev => prev.map(sb => sb.id === storybookId ? { ...sb, name: newName } : sb));
    if (selectedStorybook?.id === storybookId) {
        setSelectedStorybook(prev => prev ? { ...prev, name: newName } : null);
    }
  };

  const handleAddPanelToStorybook = (storybookId: string, panelToAdd: Panel) => {
    setStorybooks(prevStorybooks =>
      prevStorybooks.map(sb => {
        if (sb.id === storybookId) {
          if (sb.panels.some(p => p.imageUrl === panelToAdd.imageUrl && p.narrative_text === panelToAdd.narrative_text)) {
            alert('Panel ini sudah ada di dalam storybook.');
            return sb;
          }
          alert(`Panel ditambahkan ke '${sb.name}'!`);
          const panelCopy = { 
            ...panelToAdd, 
            id: `sb-${Date.now()}-${sb.panels.length}`
          };
          return { ...sb, panels: [...sb.panels, panelCopy] };
        }
        return sb;
      })
    );
  };

  const handleSelectStorybook = (storybookId: string) => {
    if (selectedStorybook?.id === storybookId) {
        setSelectedStorybook(null);
    } else {
        const book = storybooks.find(sb => sb.id === storybookId);
        if (book) {
            setSelectedStorybook(book);
        }
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedStorybook || selectedStorybook.panels.length === 0) return;

    setIsDownloadingPdf(true);
    setError(null);

    try {
        const { default: jsPDF } = await import('jspdf');
        const { default: html2canvas } = await import('html2canvas');

        const pdf = new jsPDF('p', 'mm', 'a4');
        const panelsToProcess = selectedStorybook.panels.filter(p => p.imageUrl);
        const panelsPerPage = 4;

        for (let i = 0; i < panelsToProcess.length; i += panelsPerPage) {
            if (i > 0) {
                pdf.addPage();
            }

            const pagePanels = panelsToProcess.slice(i, i + panelsPerPage);
            const pageNumber = Math.floor(i / panelsPerPage) + 1;
            
            pdf.setFontSize(10);
            pdf.setTextColor(150);
            pdf.text(selectedStorybook.name, 10, 10);
            pdf.text(`Halaman ${pageNumber}`, 200, 10, { align: 'right'});

            const canvasPromises = pagePanels.map(panel => {
                const element = panelRefs.current[panel.id];
                if (!element) {
                    console.warn(`Tidak dapat menemukan elemen DOM untuk panel ${panel.id}`);
                    return Promise.resolve(null);
                }
                const imageContainer = element.querySelector<HTMLDivElement>('.comic-panel-image-container');
                if (!imageContainer) {
                    console.warn(`Tidak dapat menemukan image container untuk panel ${panel.id}`);
                    return Promise.resolve(null);
                }
                return html2canvas(imageContainer, { scale: 2, backgroundColor: '#111827' });
            });
            
            const canvases = await Promise.all(canvasPromises);
            
            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 10;
            const headerSpace = 15;
            const gap = 4; // Celah antar panel
            
            const availableWidth = pageWidth - (margin * 2);
            const availableHeight = pageHeight - margin - headerSpace - margin;

            // Hitung dimensi panel berdasarkan dimensi yang paling membatasi (tinggi untuk A4 potret)
            const panelHeight = (availableHeight - gap) / 2;
            const panelWidth = panelHeight * (9 / 16); // Pertahankan rasio aspek

            // Pusatkan seluruh grid komik di halaman
            const totalGridWidth = (panelWidth * 2) + gap;
            const xOffset = (availableWidth - totalGridWidth) / 2;

            canvases.forEach((canvas, index) => {
                if (!canvas) return;
                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                
                const col = index % 2;
                const row = Math.floor(index / 2);

                const x = margin + xOffset + col * (panelWidth + gap);
                const y = margin + headerSpace + row * (panelHeight + gap);
                
                pdf.addImage(imgData, 'JPEG', x, y, panelWidth, panelHeight);

                // Tambahkan batas hitam tebal di sekitar setiap panel
                pdf.setDrawColor(0, 0, 0); // Warna hitam untuk batas
                pdf.setLineWidth(1.5);      // Batas tebal 1.5mm
                pdf.rect(x, y, panelWidth, panelHeight, 'S'); // 'S' untuk Stroke
            });
        }
        pdf.save(`${selectedStorybook.name.replace(/ /g, '_')}.pdf`);
    } catch (error) {
        console.error("Gagal membuat PDF:", error);
        setError("Gagal membuat PDF. Silakan coba lagi.");
    } finally {
        setIsDownloadingPdf(false);
    }
  };


  // Efek untuk me-refresh state selectedStorybook saat storybooks diubah
  useEffect(() => {
    if (selectedStorybook) {
        const updatedBook = storybooks.find(sb => sb.id === selectedStorybook.id);
        setSelectedStorybook(updatedBook || null);
    }
  }, [storybooks, selectedStorybook?.id]);

  return (
    <div className="min-h-screen font-sans">
      <Header />
      <main className="container mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
          <div className="lg:col-span-1 flex flex-col gap-6 overflow-y-auto pr-2">
            <CharacterUploader characters={characters} onCharactersChange={setCharacters} />
            <StorybookManager 
                storybooks={storybooks} 
                onCreate={handleCreateStorybook}
                onSelect={handleSelectStorybook}
                selectedStorybookId={selectedStorybook?.id || null}
                onDelete={handleDeleteStorybook}
                onUpdateName={handleUpdateStorybookName}
            />
            <StoryBuilder
              prompt={prompt}
              onPromptChange={setPrompt}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              hasCharacters={characters.length > 0}
              chatHistory={chatHistory}
              chatInput={chatInput}
              onChatInputChange={setChatInput}
              onSendMessage={handleSendMessage}
              isChatLoading={isChatLoading}
              onRefreshChat={handleRefreshChat}
            />
          </div>
          <div className="lg:col-span-2 bg-black/20 backdrop-blur-sm border border-slate-700/50 rounded-2xl flex flex-col justify-center">
             {selectedStorybook ? (
                <>
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center flex-shrink-0">
                        <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400">
                            Storybook: {selectedStorybook.name}
                        </h2>
                        <div className="flex items-center gap-2 md:gap-4">
                            <button 
                                onClick={handleDownloadPdf} 
                                disabled={isDownloadingPdf || selectedStorybook.panels.length === 0}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                <span>{isDownloadingPdf ? 'Mengunduh...' : 'Unduh PDF'}</span>
                            </button>
                           <button onClick={handleCreateNewPanelInStorybook} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-pink-600 hover:bg-pink-500 rounded-md transition-colors">
                                <PlusIcon className="w-4 h-4" />
                                <span>Panel Baru</span>
                           </button>
                           <button onClick={() => setSelectedStorybook(null)} className="px-4 py-2 text-sm font-semibold text-white bg-slate-700 hover:bg-slate-600 rounded-md transition-colors">
                                Kembali
                           </button>
                        </div>
                    </div>
                    {selectedStorybook.panels.length > 0 ? (
                        <ComicDisplay 
                            panels={selectedStorybook.panels}
                            characters={characters}
                            onPanelUpdate={handleStorybookPanelUpdate}
                            storybooks={[]}
                            onAddPanelToStorybook={() => {}}
                            onDialogueUpdate={handleStorybookDialogueUpdate}
                            onAddDialogue={handleStorybookAddDialogue}
                            onDialogueDelete={handleStorybookDialogueDelete}
                            isReadOnly={false}
                            onPanelDelete={handleDeletePanelFromStorybook}
                            onPanelReorder={handleReorderStorybookPanels}
                            onNewPanelCreate={handleCreateNewPanelInStorybook}
                            loadingPanelId={loadingPanelId}
                            setPanelRef={setPanelRef}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8 text-slate-400">
                            <h2 className="text-xl font-semibold">Storybook Ini Kosong</h2>
                            <p className="mt-2 max-w-md">Tambahkan panel dari komik yang Anda buat atau buat panel baru untuk mengisi storybook ini.</p>
                        </div>
                    )}
                </>
             ) : isLoading && panels.length === 0 ? (
               <LoadingSpinner message="Menghasilkan skrip cerita..." />
             ) : error ? (
               <div className="text-center p-8 text-red-400">
                 <h3 className="text-xl font-semibold">Oops! Terjadi Kesalahan</h3>
                 <p className="mt-2 max-w-md mx-auto">{error}</p>
                 <button onClick={() => { setError(null); }} className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-md text-white font-semibold">Tutup</button>
               </div>
             ) : (
               <ComicDisplay 
                  panels={panels}
                  characters={characters}
                  onPanelUpdate={handlePanelUpdate} 
                  storybooks={storybooks}
                  onAddPanelToStorybook={handleAddPanelToStorybook}
                  onDialogueUpdate={handleDialogueUpdate}
                  onAddDialogue={handleAddDialogue}
                  onDialogueDelete={handleDialogueDelete}
                  isReadOnly={false}
                  loadingPanelId={loadingPanelId}
                />
             )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;