import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Trash2, Clock, Folder, FolderPlus, ArrowLeft, Edit2, MoreVertical, FileText, Move } from 'lucide-react';
import { getSavedQuizzes, clearHistory, deleteQuiz, getStorageProvider, renameQuiz, getFolders, createFolder, deleteFolder, moveQuizToFolder } from '../services/storageService';
import { StorageProvider } from '../types';

interface HistoryScreenProps {
  onLoadHistory: (quiz: any) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onLoadHistory }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null); // null = root
  const [provider, setProvider] = useState<StorageProvider>('local');
  const [isLoading, setIsLoading] = useState(false);

  // Interaction State
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [tempName, setTempName] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | number | null>(null);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    const currentProvider = getStorageProvider();
    setProvider(currentProvider);
    
    const data = await getSavedQuizzes();
    setHistory(data);
    
    if (currentProvider === 'local') {
      setFolders(getFolders());
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

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
    if (confirm(`Hapus folder "${folderName}"? Isi folder akan dipindah ke halaman utama.`)) {
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
    if (confirm("Hapus quiz ini secara permanen?")) {
      await deleteQuiz(id);
      loadData();
    }
  };

  // Filter Logic
  const filteredHistory = history.filter(item => {
    if (currentFolder) return item.folder === currentFolder;
    return !item.folder; // Root shows items with no folder
  });

  return (
    <div className="max-w-5xl mx-auto pt-8 pb-24 px-4 min-h-[80vh]" onClick={() => setActiveMenuId(null)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          {currentFolder && (
            <button 
              onClick={() => setCurrentFolder(null)}
              className="p-2 bg-white rounded-full hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
              {currentFolder ? (
                <span className="flex items-center"><Folder className="mr-2 text-amber-400" fill="currentColor" /> {currentFolder}</span>
              ) : (
                <span className="flex items-center"><History className="mr-2 text-indigo-600" /> Arsip Quiz</span>
              )}
            </h2>
            <p className="text-xs text-slate-500 ml-1">
               {history.length} Files total
            </p>
          </div>
        </div>

        {provider === 'local' && !currentFolder && (
          <div className="flex space-x-2">
             <button 
               onClick={() => setShowNewFolderInput(!showNewFolderInput)}
               className="flex items-center space-x-2 px-4 py-2 bg-white/50 hover:bg-white rounded-xl text-slate-600 text-sm font-medium border border-slate-200 transition-all"
             >
               <FolderPlus size={16} /> <span>New Folder</span>
             </button>
          </div>
        )}
      </div>

      {/* New Folder Input */}
      <AnimatePresence>
        {showNewFolderInput && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="flex items-center space-x-2 bg-white p-3 rounded-2xl shadow-sm border border-indigo-100 max-w-md">
               <input 
                 autoFocus
                 type="text" 
                 value={newFolderName}
                 onChange={(e) => setNewFolderName(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                 placeholder="Nama Folder Baru..."
                 className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 font-medium placeholder:text-slate-300"
               />
               <button onClick={handleCreateFolder} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold">Buat</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOLDERS GRID (Only in Root) */}
      {!currentFolder && folders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          {folders.map(folder => (
            <motion.div 
              key={folder}
              whileHover={{ scale: 1.02 }}
              onClick={() => setCurrentFolder(folder)}
              className="relative group bg-amber-50/60 hover:bg-amber-100 border border-amber-100 p-4 rounded-2xl cursor-pointer transition-all flex flex-col items-center text-center"
            >
              <Folder size={48} className="text-amber-300 mb-2 fill-amber-200" />
              <span className="text-sm font-semibold text-slate-700 truncate w-full">{folder}</span>
              <span className="text-[10px] text-slate-400">{history.filter(i => i.folder === folder).length} items</span>
              
              <button 
                onClick={(e) => handleDeleteFolder(folder, e)}
                className="absolute top-2 right-2 p-1.5 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* FILES GRID */}
      {filteredHistory.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
           {currentFolder ? "Folder ini kosong." : "Belum ada riwayat quiz."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredHistory.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onLoadHistory(item)}
              className="relative bg-white/60 hover:bg-white border border-slate-100 hover:border-indigo-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl shrink-0">
                    <FileText size={20} />
                  </div>
                  
                  {editingId === item.id ? (
                    <div className="flex-1" onClick={e => e.stopPropagation()}>
                       <input 
                         autoFocus
                         type="text"
                         value={tempName}
                         onChange={e => setTempName(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && handleRename(item.id)}
                         onBlur={() => handleRename(item.id)}
                         className="w-full text-sm font-bold bg-white border border-indigo-200 rounded px-2 py-1"
                       />
                    </div>
                  ) : (
                    <div className="overflow-hidden">
                      <h3 className="font-semibold text-slate-700 truncate text-sm" title={item.fileName}>
                        {item.fileName}
                      </h3>
                      <p className="text-[10px] text-slate-400 flex items-center mt-0.5">
                        <Clock size={10} className="mr-1" /> {new Date(item.date).toLocaleDateString()}
                        <span className="mx-1">•</span>
                        {item.questionCount} Soal
                      </p>
                    </div>
                  )}
                </div>

                {/* Context Menu Trigger */}
                <div className="relative" onClick={e => e.stopPropagation()}>
                   <button 
                     onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                     className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                   >
                     <MoreVertical size={16} />
                   </button>

                   {/* Dropdown Menu */}
                   <AnimatePresence>
                     {activeMenuId === item.id && (
                       <motion.div 
                         initial={{ opacity: 0, scale: 0.95 }}
                         animate={{ opacity: 1, scale: 1 }}
                         exit={{ opacity: 0, scale: 0.95 }}
                         className="absolute right-0 top-8 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden"
                       >
                         <button 
                           onClick={() => { setEditingId(item.id); setTempName(item.fileName); setActiveMenuId(null); }}
                           className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center"
                         >
                           <Edit2 size={12} className="mr-2" /> Rename
                         </button>
                         
                         {/* Move to Folder Options */}
                         {folders.length > 0 && (
                            <div className="border-t border-slate-50">
                               <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 uppercase">Pindah ke</div>
                               {currentFolder && (
                                  <button onClick={() => handleMove(item.id, undefined)} className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center">
                                     <ArrowLeft size={10} className="mr-2" /> Main (Root)
                                  </button>
                               )}
                               {folders.filter(f => f !== currentFolder).map(f => (
                                  <button key={f} onClick={() => handleMove(item.id, f)} className="w-full text-left px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center">
                                     <Folder size={10} className="mr-2 text-amber-400" /> {f}
                                  </button>
                               ))}
                            </div>
                         )}

                         <div className="border-t border-slate-50">
                           <button 
                             onClick={() => handleDeleteItem(item.id)}
                             className="w-full text-left px-4 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center"
                           >
                             <Trash2 size={12} className="mr-2" /> Delete
                           </button>
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
