import React, { useRef, useCallback, useState } from 'react';
import { Character } from '../types';
import { UploadIcon } from './icons/UploadIcon';
import { SparkleIcon } from './icons/SparkleIcon';
import { generateCharacterDescription } from '../services/geminiService';

interface CharacterUploaderProps {
  characters: Character[];
  onCharactersChange: (characters: Character[]) => void;
}

const MAX_CHARACTERS = 10;

export const CharacterUploader: React.FC<CharacterUploaderProps> = ({ characters, onCharactersChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescId, setEditingDescId] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState('');
  const [isGeneratingDescId, setIsGeneratingDescId] = useState<string | null>(null);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newCharacterPromises: Promise<Omit<Character, 'name'>>[] = [];
    const availableSlots = MAX_CHARACTERS - characters.length;

    // FIX: Explicitly type the `file` parameter as `File` to resolve type inference issues.
    Array.from(files).slice(0, availableSlots).forEach((file: File) => {
      const reader = new FileReader();
      const promise = new Promise<Omit<Character, 'name'>>((resolve, reject) => {
        reader.onload = () => {
          const previewUrl = reader.result as string;
          const base64 = previewUrl.split(',')[1];
          if (base64) {
            resolve({
              id: `${file.name}-${Date.now()}`,
              file,
              base64,
              previewUrl,
              mimeType: file.type,
            });
          } else {
            reject(new Error('Gagal membaca file sebagai base64.'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      newCharacterPromises.push(promise);
    });

    Promise.all(newCharacterPromises).then(resolvedCharacters => {
      const newCharacters = resolvedCharacters.map((char, index) => ({
        ...char,
        name: `Karakter ${characters.length + index + 1}`
      }));
      onCharactersChange([...characters, ...newCharacters]);
    }).catch(error => {
        console.error("Error membaca file:", error);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [characters, onCharactersChange]);
  
  const handleRemoveCharacter = (id: string) => {
    onCharactersChange(characters.filter(char => char.id !== id));
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleNameEditStart = (character: Character) => {
    setEditingNameId(character.id);
    setEditingName(character.name);
    setEditingDescId(null);
  };

  const handleNameEditConfirm = () => {
    if (!editingNameId) return;
    onCharactersChange(
      characters.map(c => c.id === editingNameId ? { ...c, name: editingName.trim() || 'Tanpa Nama' } : c)
    );
    setEditingNameId(null);
    setEditingName('');
  };

  const handleNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleNameEditConfirm();
    } else if (event.key === 'Escape') {
      setEditingNameId(null);
      setEditingName('');
    }
  };

  const handleDescEditStart = (character: Character) => {
    setEditingDescId(character.id);
    setEditingDesc(character.description || '');
    setEditingNameId(null);
  };

  const handleDescEditConfirm = () => {
    if (!editingDescId) return;
    onCharactersChange(
      characters.map(c => c.id === editingDescId ? { ...c, description: editingDesc.trim() } : c)
    );
    setEditingDescId(null);
    setEditingDesc('');
  };

  const handleDescKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleDescEditConfirm();
    } else if (event.key === 'Escape') {
      setEditingDescId(null);
      setEditingDesc('');
    }
  };

  const handleGenerateDescription = async (character: Character) => {
      setIsGeneratingDescId(character.id);
      try {
          const description = await generateCharacterDescription({ 
              base64: character.base64, 
              mimeType: character.mimeType 
          });
          setEditingDesc(description); // Update the textarea content
      } catch (error) {
          console.error("Gagal membuat deskripsi:", error);
          alert("Gagal membuat deskripsi otomatis. Silakan coba lagi.");
      } finally {
          setIsGeneratingDescId(null);
      }
  };


  return (
    <div className="p-4 bg-black/20 backdrop-blur-sm border border-slate-700/50 rounded-2xl h-full flex flex-col">
      <h2 className="text-lg font-semibold text-slate-200 mb-3">
        Karakter ({characters.length}/{MAX_CHARACTERS})
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-5 gap-4 flex-grow overflow-y-auto pr-2">
        {characters.map((char) => (
          <div key={char.id} className="flex flex-col">
            <div className="relative aspect-square group">
              <img src={char.previewUrl} alt={char.name} className="w-full h-full object-cover rounded-lg border-2 border-transparent group-hover:border-pink-500 transition-all duration-300" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <button 
                onClick={() => handleRemoveCharacter(char.id)}
                className="absolute top-1 right-1 p-0.5 bg-red-600/80 hover:bg-red-500 rounded-full text-white leading-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="mt-1.5 w-full">
              {editingNameId === char.id ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={handleNameEditConfirm}
                  onKeyDown={handleNameKeyDown}
                  className="w-full text-center text-xs bg-slate-900 border border-pink-500 rounded-md px-1 py-0.5 text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                  autoFocus
                />
              ) : (
                <p 
                  onClick={() => handleNameEditStart(char)}
                  className="text-xs text-center text-slate-300 truncate cursor-pointer hover:text-pink-400 p-0.5"
                  title={`Klik untuk mengedit nama "${char.name}"`}
                >
                  {char.name}
                </p>
              )}
            </div>
            <div className="mt-1 w-full">
                {editingDescId === char.id ? (
                    <div className="relative">
                        <textarea
                            value={editingDesc}
                            onChange={(e) => setEditingDesc(e.target.value)}
                            onBlur={handleDescEditConfirm}
                            onKeyDown={handleDescKeyDown}
                            className="w-full text-xs bg-slate-900 border border-pink-500 rounded-md px-1 py-0.5 text-white focus:outline-none focus:ring-1 focus:ring-pink-500 pr-8"
                            placeholder="Cth: Pria 25 th, tinggi, rambut pirang, jaket kulit..."
                            rows={4}
                            autoFocus
                        />
                        <button
                            onClick={() => handleGenerateDescription(char)}
                            disabled={isGeneratingDescId === char.id}
                            className="absolute bottom-1.5 right-1.5 p-1 bg-slate-700 hover:bg-pink-600 rounded-full text-slate-300 hover:text-white transition-colors disabled:bg-slate-800 disabled:cursor-wait"
                            title="Buat deskripsi dengan AI"
                        >
                            {isGeneratingDescId === char.id ? (
                                <div className="w-4 h-4 border-2 border-slate-500 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <SparkleIcon className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                ) : (
                    <div 
                        onClick={() => handleDescEditStart(char)}
                        className="text-xs text-slate-400 p-1 cursor-pointer hover:bg-slate-800/50 rounded-md min-h-[20px]"
                        title="Klik untuk menambah/mengedit deskripsi"
                    >
                        {char.description ? (
                            <p className="italic opacity-80 truncate hover:opacity-100">"{char.description}"</p>
                        ) : (
                            <p className="text-center opacity-60 hover:opacity-100">+ Tambah Deskripsi</p>
                        )}
                    </div>
                )}
            </div>
          </div>
        ))}
         {characters.length < MAX_CHARACTERS && (
          <button 
            onClick={triggerFileInput}
            className="flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-lg hover:bg-slate-800/50 hover:border-pink-500 hover:text-pink-400 transition-colors aspect-square">
            <UploadIcon className="w-6 h-6 mb-1"/>
            <span className="text-xs">Tambah</span>
          </button>
        )}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        disabled={characters.length >= MAX_CHARACTERS}
      />
    </div>
  );
};