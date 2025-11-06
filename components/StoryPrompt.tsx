import React, { useRef, useEffect } from 'react';
import { SparkleIcon } from './icons/SparkleIcon';
import { ChatMessage } from '../types';
import { RefreshIcon } from './icons/RefreshIcon';

interface StoryBuilderProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  hasCharacters: boolean;
  chatHistory: ChatMessage[];
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSendMessage: () => void;
  isChatLoading: boolean;
  onRefreshChat: () => void;
}

export const StoryBuilder: React.FC<StoryBuilderProps> = ({
  prompt,
  onPromptChange,
  onSubmit,
  isLoading,
  hasCharacters,
  chatHistory,
  chatInput,
  onChatInputChange,
  onSendMessage,
  isChatLoading,
  onRefreshChat,
}) => {
  const isButtonDisabled = isLoading || !hasCharacters || prompt.trim().length < 10;
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleChatInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isChatLoading && chatInput.trim()) {
        onSendMessage();
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Chat Section */}
      <div className="p-4 bg-black/20 backdrop-blur-sm border border-slate-700/50 rounded-2xl">
        <label className="block text-lg font-semibold text-slate-200 mb-2 flex justify-between items-center">
          <span>Asisten Cerita AI</span>
           <button 
            onClick={onRefreshChat} 
            className="text-slate-400 hover:text-pink-400 p-1 rounded-full transition-colors disabled:text-slate-600 disabled:cursor-not-allowed" 
            title="Mulai ulang chat"
            disabled={isLoading || isChatLoading}
            aria-label="Mulai ulang chat"
          >
              <RefreshIcon className="w-4 h-4" />
          </button>
        </label>
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex flex-col gap-3 h-64">
          <div ref={chatContainerRef} className="flex-grow overflow-y-auto pr-2 space-y-3">
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs md:max-w-md lg:max-w-lg px-3 py-2 rounded-xl ${
                    msg.role === 'user' ? 'bg-pink-600 text-white' : 'bg-slate-700 text-slate-200'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {isChatLoading && (
                 <div className="flex justify-start">
                    <div className="max-w-xs md:max-w-md lg:max-w-lg px-3 py-2 rounded-xl bg-slate-700 text-slate-200">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-0"></span>
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-150"></span>
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-300"></span>
                        </div>
                    </div>
                 </div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => onChatInputChange(e.target.value)}
              onKeyPress={handleChatInputKeyPress}
              placeholder="Tanyakan sesuatu untuk memulai..."
              className="flex-grow bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
              disabled={isChatLoading || isLoading}
            />
            <button
              onClick={onSendMessage}
              disabled={isChatLoading || isLoading || !chatInput.trim()}
              className="px-4 py-2 bg-slate-600 text-slate-200 font-semibold rounded-lg hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-not-allowed transition"
            >
              Kirim
            </button>
          </div>
        </div>
      </div>
      
      {/* Final Prompt & Generate Button Section */}
      <div className="p-4 bg-black/20 backdrop-blur-sm border border-slate-700/50 rounded-2xl">
        <label htmlFor="story-prompt" className="block text-lg font-semibold text-slate-200 mb-2">
          Ide Cerita Final Anda
        </label>
        <textarea
          id="story-prompt"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="e.g., Ksatria pemberani dan naga cerdas bekerja sama mencari harta karun legendaris."
          className="w-full h-32 p-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 placeholder-slate-500 focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition"
          disabled={isLoading}
        />
      </div>
      <button
        onClick={onSubmit}
        disabled={isButtonDisabled}
        className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-500 text-white font-bold text-lg rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 hover:shadow-[0_0_20px_rgba(236,72,153,0.7)] disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
      >
        <SparkleIcon className="w-6 h-6"/>
        {isLoading ? 'Membuat Komik Anda...' : 'Buat Komik'}
      </button>
      {!hasCharacters && <p className="text-center text-sm text-yellow-400">Silakan unggah setidaknya satu karakter untuk memulai.</p>}
      {hasCharacters && prompt.trim().length < 10 && <p className="text-center text-sm text-yellow-400">Harap jelaskan ide cerita Anda (min. 10 karakter).</p>}
    </div>
  );
};