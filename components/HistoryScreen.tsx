
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Trash2, Clock, Folder, FolderPlus, ArrowLeft, Edit2, MoreVertical, FileText, Move, Search } from 'lucide-react';
import { getSavedQuizzes, deleteQuiz, getStorageProvider, renameQuiz, getFolders, createFolder, deleteFolder, moveQuizToFolder } from '../services/storageService';
import { StorageProvider } from '../types';

interface HistoryScreenProps {
  onLoadHistory: (quiz: any) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onLoadHistory }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [provider, setProvider] = useState<StorageProvider>('local');
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [tempName, setTempName] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | number | null>(null);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = async () => {
    const currentProvider = getStorageProvider();
    setProvider(currentProvider);
    const data = await getSavedQuizzes();
    setHistory(data);
    if (currentProvider === 'local') setFolders(getFolders());
  };

  useEffect(() => { loadData(); }, []);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim());
      setNewFolderName("");
      setShowNewFolderInput(false);
      loadData();
    }
  };

  const handleDeleteFolder = (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Hapus folder "${folderName}"?`)) {
      deleteFolder(folderName);
      loadData();
    }
  };

  const handleRename = (id: string | number) => {
    if (tempName.trim()) {
      renameQuiz(id, tempName.trim());
      setEditingId(null);
      setActiveMenuId(null);
      loadData();
    }
  };

  const handleMove = (id: string | number, targetFolder: string | undefined) => {
    moveQuizToFolder(id, targetFolder);
    setActiveMenuId(null);
    loadData();
  };

  const handleDeleteItem = async (id: string | number) => {
    if (confirm("Hapus quiz ini?")) {
      await deleteQuiz(id);
      loadData();
    }
  };

  const filteredHistory = history.filter(item => {
    const matchesSearch = item.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    if (searchQuery.length > 0) return matchesSearch;
    if (currentFolder) return item.folder === currentFolder;
    return !item.folder;
  });

  return (
    <div className="max-w-5xl mx-auto pt-8 pb-24 px-4 min-h-[80vh] text-theme-text" onClick={() => setActiveMenuId(null)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-2">
          {currentFolder && (
            <button onClick={() => setCurrentFolder(null)} className="p-2 bg-theme-glass rounded-full hover:bg-theme-bg/50 transition-colors">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold flex items-center">
              {currentFolder ? <span className="flex items-center"><Folder className="mr-2 text-theme-primary" fill="currentColor" /> {currentFolder}</span> : <span className="flex items-center"><History className="mr-2 text-theme-primary" /> Arsip Quiz</span>}
            </h2>
            <p className="text-xs text-theme-muted ml-1">{history.length} Files total</p>
          </div>
        </div>

        <div className="flex space-x-2 items-center w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={16} className="absolute left-3 top-3 text-theme-muted" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari quiz..."
              className="w-full pl-9 pr-4 py-2 bg-theme-glass border border-theme-border rounded-xl text-sm focus:bg-theme-bg focus:ring-2 focus:ring-theme-primary outline-none transition-all placeholder:text-theme-muted/50"
            />
          </div>
          {provider === 'local' && !currentFolder && !searchQuery && (
             <button onClick={() => setShowNewFolderInput(!showNewFolderInput)} className="p-2 bg-theme-glass hover:bg-theme-bg rounded-xl border border-theme-border transition-all">
               <FolderPlus size={20} className="text-theme-muted" />
             </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showNewFolderInput && !searchQuery && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-6 overflow-hidden">
            <div className="flex items-center space-x-2 bg-theme-glass p-3 rounded-2xl border border-theme-primary/30 max-w-md">
               <input autoFocus type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()} placeholder="Nama Folder Baru..." className="flex-1 bg-transparent border-none focus:ring-0 font-medium placeholder:text-theme-muted/50 text-theme-text" />
               <button onClick={handleCreateFolder} className="px-4 py-1.5 bg-theme-primary text-white rounded-lg text-xs font-bold">Buat</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!currentFolder && folders.length > 0 && !searchQuery && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          {folders.map(folder => (
            <motion.div key={folder} whileHover={{ scale: 1.02 }} onClick={() => setCurrentFolder(folder)} className="relative group bg-theme-primary/10 hover:bg-theme-primary/20 border border-theme-primary/20 p-4 rounded-2xl cursor-pointer transition-all flex flex-col items-center text-center">
              <Folder size={48} className="text-theme-primary mb-2 fill-theme-primary/20" />
              <span className="text-sm font-semibold truncate w-full">{folder}</span>
              <span className="text-[10px] text-theme-muted">{history.filter(i => i.folder === folder).length} items</span>
              <button onClick={(e) => handleDeleteFolder(folder, e)} className="absolute top-2 right-2 p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12} /></button>
            </motion.div>
          ))}
        </div>
      )}

      {filteredHistory.length === 0 ? (
        <div className="text-center py-12 text-theme-muted opacity-60">
           {searchQuery ? `Tidak ditemukan quiz dengan nama "${searchQuery}".` : currentFolder ? "Folder ini kosong." : "Belum ada riwayat quiz."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHistory.map((item, index) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} onClick={() => onLoadHistory(item)} className="relative bg-theme-glass hover:bg-theme-bg border border-theme-border hover:border-theme-primary/30 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="p-3 bg-theme-primary/10 text-theme-primary rounded-xl shrink-0"><FileText size={20} /></div>
                  
                  {editingId === item.id ? (
                    <div className="flex-1" onClick={e => e.stopPropagation()}>
                       <input autoFocus type="text" value={tempName} onChange={e => setTempName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRename(item.id)} onBlur={() => handleRename(item.id)} className="w-full text-sm font-bold bg-theme-bg border border-theme-primary rounded px-2 py-1 text-theme-text" />
                    </div>
                  ) : (
                    <div className="overflow-hidden">
                      <h3 className="font-semibold truncate text-sm" title={item.fileName}>{item.fileName}</h3>
                      <p className="text-[10px] text-theme-muted flex items-center mt-0.5">
                        <Clock size={10} className="mr-1" /> {new Date(item.date).toLocaleDateString()}
                        <span className="mx-1">•</span> {item.questionCount} Soal
                        {searchQuery && item.folder && <span className="ml-2 bg-theme-primary/10 text-theme-primary px-1.5 py-0.5 rounded text-[9px] flex items-center"><Folder size={8} className="mr-1" /> {item.folder}</span>}
                      </p>
                    </div>
                  )}
                </div>

                <div className="relative" onClick={e => e.stopPropagation()}>
                   <button onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)} className="p-1.5 text-theme-muted hover:text-theme-primary rounded-lg hover:bg-theme-bg transition-colors"><MoreVertical size={16} /></button>
                   <AnimatePresence>
                     {activeMenuId === item.id && (
                       <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 top-8 w-40 bg-theme-bg border border-theme-border rounded-xl shadow-xl z-50 overflow-hidden">
                         <button onClick={() => { setEditingId(item.id); setTempName(item.fileName); setActiveMenuId(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-theme-primary/10 flex items-center"><Edit2 size={12} className="mr-2" /> Rename</button>
                         {folders.length > 0 && (
                            <div className="border-t border-theme-border">
                               <div className="px-4 py-1.5 text-[10px] font-bold text-theme-muted uppercase">Pindah ke</div>
                               {currentFolder && <button onClick={() => handleMove(item.id, undefined)} className="w-full text-left px-4 py-2 text-xs hover:bg-theme-primary/10 flex items-center"><ArrowLeft size={10} className="mr-2" /> Main (Root)</button>}
                               {folders.filter(f => f !== currentFolder).map(f => (
                                  <button key={f} onClick={() => handleMove(item.id, f)} className="w-full text-left px-4 py-2 text-xs hover:bg-theme-primary/10 flex items-center"><Folder size={10} className="mr-2 text-theme-primary" /> {f}</button>
                               ))}
                            </div>
                         )}
                         <div className="border-t border-theme-border">
                           <button onClick={() => handleDeleteItem(item.id)} className="w-full text-left px-4 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center"><Trash2 size={12} className="mr-2" /> Delete</button>
                         </div>
                       </motion.div>
                     )}
                   </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
