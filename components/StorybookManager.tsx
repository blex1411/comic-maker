import React, { useState } from 'react';
import { Storybook } from '../types';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';

interface StorybookManagerProps {
  storybooks: Storybook[];
  onCreate: (name: string) => void;
  onSelect: (id: string) => void;
  selectedStorybookId: string | null;
  onUpdateName: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
}

const BookIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
);

const STORYBOOK_PANEL_LIMIT = 100;

export const StorybookManager: React.FC<StorybookManagerProps> = ({ storybooks, onCreate, onSelect, selectedStorybookId, onUpdateName, onDelete }) => {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleCreate = () => {
    if (newName.trim()) {
      onCreate(newName.trim());
      setNewName('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  };
  
  const handleEditStart = (storybook: Storybook) => {
    setEditingId(storybook.id);
    setEditingName(storybook.name);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleEditConfirm = () => {
    if (editingId && editingName.trim()) {
      onUpdateName(editingId, editingName.trim());
    }
    handleEditCancel();
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleEditConfirm();
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };


  return (
    <div className="p-4 bg-black/20 backdrop-blur-sm border border-slate-700/50 rounded-2xl flex flex-col">
      <h2 className="text-lg font-semibold text-slate-200 mb-3">Storybooks</h2>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Nama storybook baru..."
          className="flex-grow bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim()}
          className="px-4 py-2 bg-pink-600 text-white font-semibold rounded-lg hover:bg-pink-500 disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
        >
          Buat
        </button>
      </div>
      <div className="flex-grow overflow-y-auto pr-2 space-y-2 max-h-40">
        {storybooks.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Belum ada storybook. Buat satu untuk memulai!</p>
        ) : (
          storybooks.map(sb => {
            const isSelected = sb.id === selectedStorybookId;
            const panelPercentage = (sb.panels.length / STORYBOOK_PANEL_LIMIT) * 100;

            return (
              <div key={sb.id}>
                {editingId === sb.id ? (
                  <div className="flex items-center gap-2 p-2 bg-slate-700 rounded-lg">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={handleEditConfirm}
                      className="w-full text-sm bg-slate-800 border border-pink-500 rounded px-2 py-1 text-white focus:outline-none"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="relative group">
                    <div
                        role="button"
                        aria-pressed={isSelected}
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(sb.id); }}
                        onClick={() => onSelect(sb.id)}
                        className={`w-full p-3 rounded-lg text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-pink-500 ${
                            isSelected ? 'bg-pink-600 shadow-lg shadow-pink-500/20' : 'bg-slate-800/70 hover:bg-slate-700/80 cursor-pointer'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 truncate">
                                <BookIcon className={`w-4 h-4 flex-shrink-0 transition-colors ${isSelected ? 'text-white' : 'text-cyan-400'}`}/>
                                <span className={`text-sm font-medium truncate transition-colors ${isSelected ? 'text-white' : 'text-slate-200'}`}>{sb.name}</span>
                            </div>
                            <span className={`text-xs font-mono transition-colors ${isSelected ? 'text-pink-200' : 'text-slate-400'}`}>
                                {sb.panels.length}/{STORYBOOK_PANEL_LIMIT}
                            </span>
                        </div>
                        <div className={`w-full rounded-full h-1.5 ${isSelected ? 'bg-pink-800' : 'bg-slate-700'}`}>
                            <div
                                className={`h-1.5 rounded-full transition-all ${isSelected ? 'bg-white' : 'bg-cyan-400'}`}
                                style={{ width: `${panelPercentage}%` }}
                            ></div>
                        </div>
                    </div>
                     <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-2 bg-slate-800/80 backdrop-blur-sm p-1 rounded-md">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditStart(sb); }}
                          className="text-slate-300 hover:text-cyan-400 transition-colors"
                          title="Ubah nama"
                        >
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(sb.id); }}
                          className="text-slate-300 hover:text-red-400 transition-colors"
                          title="Hapus storybook"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  );
};
