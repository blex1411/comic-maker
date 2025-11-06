import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Panel, Storybook, Dialogue, Character } from '../types';
import { LoadingSpinner } from './LoadingSpinner';
import { SpeechBubble } from './SpeechBubble';
import { RefreshIcon } from './icons/RefreshIcon';
import { AddBubbleIcon } from './icons/AddBubbleIcon';
import { PromptIcon } from './icons/PromptIcon';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';
import { SparkleIcon } from './icons/SparkleIcon';
import { UploadIcon } from './icons/UploadIcon';
import { DownloadIcon } from './icons/DownloadIcon';

// --- Helper Icons for UI ---
const SaveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
    </svg>
);

const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);


// --- Individual Panel Card Component ---
interface PanelCardProps {
    panel: Panel;
    characters: Character[];
    onUpdate: (updatedPanel: Panel, skipRegeneration?: boolean) => void;
    storybooks: Storybook[];
    onAddPanelToStorybook: (storybookId: string, panel: Panel) => void;
    onDialogueUpdate: (panelId: string, dialogueIndex: number, updatedDialogue: Dialogue) => void;
    onAddDialogue: (panelId: string) => void;
    onDialogueDelete: (panelId: string, dialogueIndex: number) => void;
    isReadOnly?: boolean;
    onDelete?: (panelId: string) => void;
    draggable: boolean;
    onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
    isBeingDraggedOver: boolean;
    loadingPanelId?: string | null;
}

const PanelCard: React.FC<PanelCardProps> = ({ 
    panel, characters, onUpdate, storybooks, onAddPanelToStorybook, onDialogueUpdate, onAddDialogue, onDialogueDelete, isReadOnly, onDelete,
    draggable, onDragStart, onDragOver, onDrop, onDragEnd, isBeingDraggedOver, loadingPanelId
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedPanel, setEditedPanel] = useState<Panel>(panel);
    const [selectedStorybookId, setSelectedStorybookId] = useState<string>('');
    const imageContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);


    const [isEditingPrompt, setIsEditingPrompt] = useState(false);
    const [editedPrompt, setEditedPrompt] = useState(panel.visual_description);

    const isLoading = loadingPanelId === panel.id;

    const { formatText, unformatText } = useMemo(() => {
        if (!characters || characters.length === 0) {
            return { 
                formatText: (text: string) => text, 
                unformatText: (text: string) => text 
            };
        }

        const placeholderToNameMap = new Map<string, string>();
        const nameToPlaceholderMap = new Map<string, string>();
        const sortedNames: string[] = [];

        characters.forEach((char, index) => {
            const placeholder = `[CHARACTER_${index + 1}]`;
            placeholderToNameMap.set(placeholder, char.name);
            nameToPlaceholderMap.set(char.name.toLowerCase(), placeholder);
            sortedNames.push(char.name);
        });
        
        sortedNames.sort((a, b) => b.length - a.length);

        const formatText = (text: string): string => {
            let formattedText = text;
            placeholderToNameMap.forEach((name, placeholder) => {
                const regex = new RegExp(placeholder.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g');
                formattedText = formattedText.replace(regex, name);
            });
            return formattedText;
        };
        
        const unformatText = (text: string): string => {
            if (sortedNames.length === 0) return text;

            const nameRegex = new RegExp(`\\b(${sortedNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
            
            return text.replace(nameRegex, (matchedName) => {
                return nameToPlaceholderMap.get(matchedName.toLowerCase()) || matchedName;
            });
        };

        return { formatText, unformatText };
    }, [characters]);

    const newPanelPlaceholder = useMemo(() => {
        return formatText("Contoh: [CHARACTER_1] melompat dari gedung...");
    }, [formatText]);

    useEffect(() => {
        setEditedPanel(panel);
    }, [panel]);

    useEffect(() => {
        if (storybooks.length > 0 && !selectedStorybookId) {
            setSelectedStorybookId(storybooks[0].id);
        }
    }, [storybooks, selectedStorybookId]);

    const handleSave = () => {
        onUpdate(editedPanel, true);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditedPanel(panel);
        setIsEditing(false);
    };

    const handleNarrativeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditedPanel(prev => ({...prev, narrative_text: e.target.value}));
    };

    const handleAddToStorybook = () => {
        if (selectedStorybookId && panel.imageUrl) {
            onAddPanelToStorybook(selectedStorybookId, panel);
        }
    };
    
    const handlePromptEditStart = () => {
        setEditedPrompt(formatText(panel.visual_description));
        setIsEditingPrompt(true);
    };

    const handlePromptEditCancel = () => {
        setIsEditingPrompt(false);
    };

    const handlePromptEditSave = () => {
        onUpdate({ ...panel, visual_description: unformatText(editedPrompt) });
        setIsEditingPrompt(false);
    };

    const handleGenerateNewImage = () => {
        if (editedPanel.visual_description.trim() === '') {
            alert('Harap masukkan deskripsi visual untuk membuat gambar.');
            return;
        }
        onUpdate({ ...editedPanel, visual_description: unformatText(editedPanel.visual_description) });
    };
    
    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const imageUrl = reader.result as string;
            onUpdate({ ...editedPanel, imageUrl }, true); 
        };
        reader.readAsDataURL(file);

        if (event.target) {
            event.target.value = ''; // Reset input
        }
    };

    const handleDownloadPanel = async () => {
        if (!imageContainerRef.current) {
            alert("Elemen panel tidak ditemukan untuk diunduh.");
            return;
        }

        try {
            const { default: html2canvas } = await import('html2canvas');
            const canvas = await html2canvas(imageContainerRef.current, {
                scale: 2, // Higher resolution for better quality
                backgroundColor: '#111827',
                useCORS: true,
                onclone: (clonedDoc) => {
                    const container = clonedDoc.querySelector('.comic-panel-image-container');
                    if (!container) return;

                    // Replace textareas with paragraphs for correct rendering
                    container.querySelectorAll('textarea').forEach(textarea => {
                        const p = clonedDoc.createElement('p');
                        p.className = textarea.className;
                        // Important: Manually apply styles that might not be captured by className alone
                        p.style.cssText = textarea.style.cssText;
                        p.style.width = '100%';
                        p.style.height = '100%';
                        p.style.padding = '0';
                        p.style.margin = '0';
                        p.innerText = textarea.value || ' ';
                        textarea.parentNode?.replaceChild(p, textarea);
                    });
                },
            });

            const link = document.createElement('a');
            link.download = `comic-panel-${panel.panel_number}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error("Gagal mengunduh panel:", err);
            alert("Gagal mengunduh panel. Silakan coba lagi.");
        }
    };


    return (
        <div 
            className={`bg-slate-900/70 border border-slate-700 rounded-xl overflow-hidden shadow-lg flex flex-col transition-all duration-300 hover:border-pink-500/80 hover:shadow-[0_0_20px_rgba(236,72,153,0.4)] ${isBeingDraggedOver ? 'ring-2 ring-cyan-400 scale-105' : ''} ${draggable ? 'cursor-grab' : ''}`}
            draggable={draggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
        >
            <div className="p-4 bg-slate-900/50 border-b border-slate-700 min-h-[64px]">
                 {isEditing && !isReadOnly ? (
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Narasi Panel {panel.panel_number}</label>
                        <textarea
                            value={editedPanel.narrative_text}
                            onChange={handleNarrativeChange}
                            className="w-full p-2 text-sm bg-slate-800 border border-slate-600 rounded-md text-slate-200 focus:ring-1 focus:ring-pink-500"
                            rows={3}
                        />
                        <p className="text-xs text-slate-400 mt-1">Untuk mengedit dialog, klik dua kali pada gelembung teks di gambar.</p>
                        <div className="flex justify-end gap-2 mt-3">
                            <button onClick={handleCancel} className="px-3 py-1 text-xs font-semibold text-slate-300 bg-slate-600 hover:bg-slate-500 rounded-md transition-colors">Batal</button>
                            <button onClick={handleSave} className="px-3 py-1 text-xs font-semibold text-white bg-pink-600 hover:bg-pink-500 rounded-md transition-colors flex items-center gap-1">
                                <SaveIcon className="w-3 h-3"/> Simpan
                            </button>
                        </div>
                    </div>
                ) : (
                     <div className="flex justify-between items-start gap-2">
                        <p className="text-sm text-slate-300 flex-grow">
                            <span className="font-bold not-italic text-slate-100">Panel {panel.panel_number}:</span> <span className="italic">{formatText(panel.narrative_text)}</span>
                        </p>
                        <div className="flex items-center flex-shrink-0 -mt-1 -mr-1">
                            {!isReadOnly && (
                                <button onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-cyan-400 transition-colors p-1 rounded-full">
                                    <EditIcon className="w-4 h-4" />
                                </button>
                            )}
                            {onDelete && (
                                <button onClick={() => onDelete(panel.id)} className="text-slate-400 hover:text-red-400 transition-colors p-1 rounded-full" title="Hapus panel">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <div ref={imageContainerRef} className="relative aspect-[9/16] bg-gray-900 flex items-center justify-center flex-grow group comic-panel-image-container">
              {isLoading ? (
                  <LoadingSpinner message={`Membuat gambar panel ${panel.panel_number}...`} />
              ) : panel.imageUrl ? (
                <>
                    <img src={panel.imageUrl} alt={`Panel ${panel.panel_number}: ${panel.visual_description}`} className="w-full h-full object-cover" />
                    {!isReadOnly && panel.dialogues?.map((dialogue, index) => (
                        <SpeechBubble
                            key={index}
                            dialogue={dialogue}
                            onUpdate={(updatedDialogue) => onDialogueUpdate(panel.id, index, updatedDialogue)}
                            onDelete={() => onDialogueDelete(panel.id, index)}
                            containerRef={imageContainerRef}
                        />
                    ))}
                    {isEditingPrompt && !isReadOnly && (
                        <div className="absolute inset-0 bg-black/70 z-30 flex flex-col p-4 gap-2 backdrop-blur-sm">
                            <label className="text-sm font-bold text-slate-200">Edit Prompt Gambar</label>
                            <textarea
                                value={editedPrompt}
                                onChange={(e) => setEditedPrompt(e.target.value)}
                                className="w-full flex-grow p-2 text-sm bg-slate-900 border border-slate-600 rounded-md text-slate-200 focus:ring-1 focus:ring-pink-500"
                                rows={6}
                                autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={handlePromptEditCancel} className="px-3 py-1 text-xs font-semibold text-slate-300 bg-slate-600 hover:bg-slate-500 rounded-md transition-colors">Batal</button>
                                <button onClick={handlePromptEditSave} className="px-3 py-1 text-xs font-semibold text-white bg-pink-600 hover:bg-pink-500 rounded-md transition-colors">Simpan & Buat Ulang</button>
                            </div>
                        </div>
                    )}
                    {!isReadOnly && (
                        <>
                             <button
                                onClick={handlePromptEditStart}
                                className="absolute top-3 right-3 flex items-center justify-center p-2 bg-black/40 text-slate-200 rounded-full backdrop-blur-sm transition-all duration-200 opacity-0 group-hover:opacity-100 hover:bg-pink-600 hover:text-white hover:scale-110 z-20"
                                aria-label="Edit prompt gambar"
                                title="Edit prompt gambar"
                            >
                                <PromptIcon className="w-5 h-5" />
                            </button>
                             <button
                                onClick={() => onAddDialogue(panel.id)}
                                className="absolute bottom-3 left-3 flex items-center justify-center p-2 bg-black/40 text-slate-200 rounded-full backdrop-blur-sm transition-all duration-200 opacity-0 group-hover:opacity-100 hover:bg-pink-600 hover:text-white hover:scale-110 z-20"
                                aria-label="Tambah gelembung teks"
                                title="Tambah gelembung teks"
                            >
                                <AddBubbleIcon className="w-5 h-5" />
                            </button>
                             <button
                                onClick={handleDownloadPanel}
                                className="absolute bottom-3 left-14 flex items-center justify-center p-2 bg-black/40 text-slate-200 rounded-full backdrop-blur-sm transition-all duration-200 opacity-0 group-hover:opacity-100 hover:bg-cyan-600 hover:text-white hover:scale-110 z-20"
                                aria-label="Unduh panel"
                                title="Unduh panel"
                            >
                                <DownloadIcon className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => onUpdate(panel)}
                                className="absolute bottom-3 right-3 flex items-center justify-center p-2 bg-black/40 text-slate-200 rounded-full backdrop-blur-sm transition-all duration-200 opacity-0 group-hover:opacity-100 hover:bg-pink-600 hover:text-white hover:scale-110 z-20"
                                aria-label="Buat ulang gambar panel"
                                title="Buat ulang gambar"
                            >
                                <RefreshIcon className="w-5 h-5" />
                            </button>
                        </>
                    )}
                </>
              ) : (
                <div className="w-full h-full flex flex-col p-4 gap-3 bg-slate-800/50">
                    <h3 className="text-center font-semibold text-slate-200">Buat Panel Baru</h3>
                    <p className="text-xs text-center text-slate-400 -mt-2">Tulis deskripsi visual untuk adegan ini.</p>
                    <div className="flex-grow flex flex-col">
                        <label htmlFor={`visual-${panel.id}`} className="text-sm font-bold text-slate-400 mb-1">Deskripsi Visual</label>
                        <textarea
                            id={`visual-${panel.id}`}
                            value={editedPanel.visual_description}
                            onChange={(e) => setEditedPanel(p => ({...p, visual_description: e.target.value}))}
                            className="w-full flex-grow p-2 text-sm bg-slate-900 border border-slate-600 rounded-md text-slate-200 focus:ring-1 focus:ring-pink-500"
                            placeholder={newPanelPlaceholder}
                            autoFocus
                        />
                    </div>
                    <div className="w-full mt-2 flex flex-col gap-2">
                        <button 
                            onClick={handleGenerateNewImage} 
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-500 text-white font-bold rounded-lg hover:scale-105 transition-transform"
                        >
                           <SparkleIcon className="w-4 h-4"/> Buat Gambar AI
                        </button>
                        <div className="flex items-center gap-2">
                            <hr className="flex-grow border-slate-600" />
                            <span className="text-xs text-slate-500">ATAU</span>
                            <hr className="flex-grow border-slate-600" />
                        </div>
                        <button 
                            onClick={handleUploadClick} 
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white font-bold rounded-lg hover:bg-slate-500 transition-colors"
                        >
                           <UploadIcon className="w-4 h-4"/> Unggah dari Perangkat
                        </button>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/png, image/jpeg, image/webp"
                        className="hidden"
                    />
                </div>
              )}
            </div>
            {!isReadOnly && panel.imageUrl && storybooks.length > 0 && (
                <div className="p-3 bg-slate-900/50 border-t border-slate-700 flex items-center gap-2">
                    <select
                        value={selectedStorybookId}
                        onChange={(e) => setSelectedStorybookId(e.target.value)}
                        className="flex-grow bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition"
                        aria-label="Pilih storybook"
                    >
                        {storybooks.map(sb => (
                            <option key={sb.id} value={sb.id}>{sb.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleAddToStorybook}
                        disabled={!selectedStorybookId}
                        className="px-3 py-1.5 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                        Tambah
                    </button>
                </div>
            )}
        </div>
    );
};

// --- Main Comic Display Component ---
interface ComicDisplayProps {
  panels: Panel[];
  characters: Character[];
  onPanelUpdate: (updatedPanel: Panel, skipRegeneration?: boolean) => void;
  storybooks: Storybook[];
  onAddPanelToStorybook: (storybookId: string, panel: Panel) => void;
  onDialogueUpdate: (panelId: string, dialogueIndex: number, updatedDialogue: Dialogue) => void;
  onAddDialogue: (panelId: string) => void;
  onDialogueDelete: (panelId: string, dialogueIndex: number) => void;
  isReadOnly?: boolean;
  onPanelDelete?: (panelId: string) => void;
  onPanelReorder?: (draggedId: string, targetId: string) => void;
  onNewPanelCreate?: () => void;
  loadingPanelId?: string | null;
  setPanelRef?: (id: string, el: HTMLDivElement | null) => void;
}

export const ComicDisplay: React.FC<ComicDisplayProps> = ({ 
    panels, characters, onPanelUpdate, storybooks, onAddPanelToStorybook, 
    onDialogueUpdate, onAddDialogue, onDialogueDelete, isReadOnly,
    onPanelDelete, onPanelReorder, onNewPanelCreate, loadingPanelId, setPanelRef
}) => {
    const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
    const [dragOverPanelId, setDragOverPanelId] = useState<string | null>(null);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, panelId: string) => {
        setDraggedPanelId(panelId);
        e.dataTransfer.effectAllowed = 'move';
        // Optional: you can set data to be dragged
        e.dataTransfer.setData('text/plain', panelId);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, panelId: string) => {
        e.preventDefault(); // Necessary to allow dropping
        if (panelId !== dragOverPanelId) {
            setDragOverPanelId(panelId);
        }
    };
    
    const handleDragLeave = () => {
        setDragOverPanelId(null);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetPanelId: string) => {
        e.preventDefault();
        if (draggedPanelId && onPanelReorder && draggedPanelId !== targetPanelId) {
            onPanelReorder(draggedPanelId, targetPanelId);
        }
        setDragOverPanelId(null);
        setDraggedPanelId(null);
    };

    const handleDragEnd = () => {
        setDraggedPanelId(null);
        setDragOverPanelId(null);
    };


  if (panels.length === 0 && !isReadOnly && !onNewPanelCreate) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 text-slate-400">
        <h2 className="text-xl font-semibold">Selamat Datang di Comic Craft AI!</h2>
        <p className="mt-2 max-w-md">
          Unggah karakter Anda, tulis ide cerita di asisten AI, lalu klik 'Buat Komik' untuk melihat keajaiban terjadi.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-full overflow-y-auto" onDragLeave={handleDragLeave}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {panels.map((panel) => (
            <div 
                key={panel.id} 
                className={draggedPanelId === panel.id ? 'opacity-40' : 'opacity-100'}
                ref={(el) => setPanelRef && setPanelRef(panel.id, el)}
            >
                <PanelCard 
                    panel={panel} 
                    characters={characters}
                    onUpdate={onPanelUpdate}
                    storybooks={storybooks}
                    onAddPanelToStorybook={onAddPanelToStorybook}
                    onDialogueUpdate={onDialogueUpdate}
                    onAddDialogue={onAddDialogue}
                    onDialogueDelete={onDialogueDelete}
                    isReadOnly={isReadOnly}
                    onDelete={onPanelDelete}
                    draggable={!!onPanelReorder}
                    onDragStart={(e) => handleDragStart(e, panel.id)}
                    onDragOver={(e) => handleDragOver(e, panel.id)}
                    onDrop={(e) => handleDrop(e, panel.id)}
                    onDragEnd={handleDragEnd}
                    isBeingDraggedOver={dragOverPanelId === panel.id && draggedPanelId !== panel.id}
                    loadingPanelId={loadingPanelId}
                />
            </div>
        ))}
        {onNewPanelCreate && (
            <button
                onClick={onNewPanelCreate}
                className="flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-xl hover:bg-slate-800/50 hover:border-pink-500 hover:text-pink-400 transition-colors aspect-[9/16] min-h-[300px]"
            >
                <PlusIcon className="w-10 h-10 mb-2"/>
                <span className="text-lg font-semibold">Tambah Panel Baru</span>
            </button>
        )}
      </div>
    </div>
  );
};