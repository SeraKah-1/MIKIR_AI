
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Clock, Edit3, Edit2, MoreVertical, FileText, Search, RefreshCw, Cloud, HardDrive, Layout, TrendingUp, Zap, Skull, CloudUpload, Play, Trash2, Tag, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { 
  getSavedQuizzes, renameQuiz, deleteQuiz,
  fetchCloudQuizzes, getStorageProvider, uploadToCloud, deleteFromCloud,
  updateLocalQuizQuestions, updateCloudQuizQuestions, downloadFromCloud
} from '../services/storageService';
import { EditQuizModal } from './EditQuizModal';
import { QuizMode } from '../types';

interface HistoryScreenProps {
  onLoadHistory: (quiz: any) => void;
}

// --- UTILS ---
const getModeBadge = (mode: string) => {
  switch(mode) {
    case QuizMode.SURVIVAL: return { icon: Skull, label: 'Survival', color: 'bg-rose-100 text-rose-600 border-rose-200' };
    case QuizMode.TIME_RUSH: return { icon: Zap, label: 'Time Rush', color: 'bg-amber-100 text-amber-600 border-amber-200' };
    case QuizMode.SCAFFOLDING: return { icon: TrendingUp, label: 'Bertahap', color: 'bg-blue-100 text-blue-600 border-blue-200' };
    default: return { icon: Layout, label: 'Standard', color: 'bg-indigo-50 text-indigo-600 border-indigo-200' };
  }
};

const getScoreColor = (score: number | null) => {
  if (score === null || score === undefined) return "bg-slate-100 text-slate-400 border-slate-200";
  if (score >= 80) return "bg-emerald-100 text-emerald-600 border-emerald-200";
  if (score >= 60) return "bg-indigo-100 text-indigo-600 border-indigo-200";
  return "bg-rose-100 text-rose-600 border-rose-200";
};

// --- COMPONENT ---
export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onLoadHistory }) => {
  const [viewMode, setViewMode] = useState<'local' | 'cloud'>('local');
  const [localHistory, setLocalHistory] = useState<any[]>([]);
  const [cloudHistory, setCloudHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCloudConfigured, setIsCloudConfigured] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<'all' | 'survival' | 'low_score' | 'new'>('all');

  // Actions
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [tempName, setTempName] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | number | null>(null);
  const [quizToEdit, setQuizToEdit] = useState<any | null>(null);

  useEffect(() => {
    refreshLocal();
    setIsCloudConfigured(getStorageProvider() === 'supabase');
  }, []);

  const refreshLocal = async () => {
    // Local storage is sync/fast, no need to show loading spinner usually
    // But we keep it async in signature for consistency
    const data = await getSavedQuizzes();
    setLocalHistory(data);
  };

  const refreshCloud = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCloudQuizzes();
      setCloudHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const switchView = (mode: 'local' | 'cloud') => {
    setViewMode(mode);
    if (mode === 'local') refreshLocal();
    else if (isCloudConfigured) refreshCloud();
  };

  // --- LOGIC ---
  const handleUpload = async (item: any) => {
    if (!isCloudConfigured) {
      alert("Aktifkan Supabase di Settings dulu untuk upload.");
      return;
    }
    if (confirm(`Upload "${item.fileName}" ke Cloud?`)) {
       try {
         await uploadToCloud(item);
         alert("Berhasil diupload!");
       } catch (e: any) {
         alert("Gagal upload: " + e.message);
       }
    }
  };

  const handleDownload = async (item: any) => {
     try {
       await downloadFromCloud(item);
       setActiveMenuId(null);
       // Langsung tawarkan pindah tab
       if (confirm(`Berhasil disimpan! Buka tab "Local" untuk melihat?`)) {
          setViewMode('local');
          refreshLocal();
       }
     } catch (e: any) {
       alert("Gagal unduh: " + e.message);
     }
  };

  const handleDelete = async (id: number | string) => {
    if (confirm("Yakin hapus kuis ini?")) {
      if (viewMode === 'local') {
        await deleteQuiz(id);
        refreshLocal();
      } else {
        await deleteFromCloud(id);
        refreshCloud();
      }
    }
  };

  const handleRename = async (id: number | string) => {
     if (!tempName.trim()) return;
     await renameQuiz(id, tempName.trim());
     setEditingId(null);
     refreshLocal();
  };

  const saveEditedQuestions = async (newQuestions: any[]) => {
    if (!quizToEdit) return;
    try {
      if (viewMode === 'local') {
        await updateLocalQuizQuestions(quizToEdit.id, newQuestions);
        await refreshLocal();
      } else {
        await updateCloudQuizQuestions(quizToEdit.id, newQuestions);
        await refreshCloud();
      }
    } catch (e: any) { alert("Error saving: " + e.message); }
  };

  const openEditModal = (quiz: any) => {
    setQuizToEdit(quiz);
  };

  // --- FILTERED LIST ---
  const filteredList = useMemo(() => {
    const raw = viewMode === 'local' ? localHistory : cloudHistory;
    return raw.filter(item => {
      // 1. Search
      if (searchQuery && !item.fileName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      
      // 2. Chips
      if (activeFilter === 'survival' && item.mode !== QuizMode.SURVIVAL) return false;
      if (activeFilter === 'low_score' && (item.lastScore === null || item.lastScore >= 60)) return false;
      if (activeFilter === 'new' && item.lastScore !== null && item.lastScore !== undefined) return false;

      return true;
    });
  }, [localHistory, cloudHistory, viewMode, searchQuery, activeFilter]);

  return (
    <div className="max-w-4xl mx-auto pt-8 pb-24 px-4 min-h-[80vh] text-theme-text" onClick={() => setActiveMenuId(null)}>
      
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-6 mb-8">
         <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold flex items-center text-slate-800">
                <History className="mr-3 text-indigo-500" /> Pusat Data
              </h2>
              <p className="text-slate-500 text-sm mt-1">Kelola arsip soal dan riwayat nilaimu.</p>
            </div>
            
            {/* View Switcher */}
            <div className="bg-slate-100 p-1 rounded-xl flex shadow-inner">
               <button 
                 onClick={() => switchView('local')} 
                 className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'local' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 <HardDrive size={16} className="mr-2" /> Local
               </button>
               <button 
                 onClick={() => switchView('cloud')} 
                 className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'cloud' ? 'bg-white shadow text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 <Cloud size={16} className="mr-2" /> Cloud
               </button>
            </div>
         </div>

         {/* Search & Filters */}
         <div className="space-y-4">
            <div className="relative">
               <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
               <input 
                 type="text" 
                 placeholder={`Cari di ${viewMode === 'local' ? 'penyimpanan HP' : 'database Cloud'}...`}
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
               />
               {viewMode === 'cloud' && (
                 <button onClick={refreshCloud} className="absolute right-3 top-2 p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                    <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                 </button>
               )}
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
               {[
                 { id: 'all', label: 'Semua', icon: Layout },
                 { id: 'new', label: 'Belum Dikerjakan', icon: Clock },
                 { id: 'survival', label: 'Survival Mode', icon: Skull },
                 { id: 'low_score', label: 'Perlu Remedial', icon: AlertCircle },
               ].map(filter => (
                 <button
                   key={filter.id}
                   onClick={() => setActiveFilter(filter.id as any)}
                   className={`
                     flex items-center px-4 py-2 rounded-full text-xs font-bold border transition-all whitespace-nowrap
                     ${activeFilter === filter.id 
                       ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' 
                       : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-500'}
                   `}
                 >
                   <filter.icon size={14} className="mr-2" /> {filter.label}
                 </button>
               ))}
            </div>
         </div>
      </div>

      {/* CONTENT LIST */}
      <div className="grid gap-4">
        <AnimatePresence mode='popLayout'>
          {filteredList.length === 0 && !isLoading ? (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 flex flex-col items-center">
                <div className="text-6xl mb-4 opacity-50">¯\_(ツ)_/¯</div>
                <p className="text-slate-500 font-medium">Tidak ada kuis yang cocok.</p>
                {activeFilter !== 'all' && (
                  <button onClick={() => setActiveFilter('all')} className="mt-4 text-indigo-500 text-sm font-bold hover:underline">Reset Filter</button>
                )}
             </motion.div>
          ) : (
            filteredList.map((item, idx) => {
               const modeBadge = getModeBadge(item.mode);
               const scoreColor = getScoreColor(item.lastScore);
               
               return (
                 <motion.div
                   key={item.id}
                   // OPTIMIZATION: Simplified animations for list items to reduce GPU load
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   transition={{ duration: 0.2, delay: idx * 0.03 }}
                   className={`group bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-xl hover:border-indigo-200 transition-all relative ${activeMenuId === item.id ? 'z-50' : 'z-0'}`}
                 >
                    {/* Decorative Gradient Bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${modeBadge.color.replace('bg-', 'bg-').replace('text-', 'bg-').split(' ')[0]}`} />

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-3">
                       
                       {/* MAIN INFO */}
                       <div className="flex-1 min-w-0" onClick={() => onLoadHistory(item)}>
                          <div className="flex items-center gap-2 mb-1">
                             <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${modeBadge.color}`}>
                                {modeBadge.label}
                             </span>
                             <span className="text-[10px] text-slate-400 flex items-center">
                                <Clock size={10} className="mr-1" />
                                {new Date(item.date).toLocaleDateString()}
                             </span>
                          </div>

                          {editingId === item.id ? (
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                               <input 
                                 autoFocus 
                                 value={tempName} 
                                 onChange={e => setTempName(e.target.value)} 
                                 onBlur={() => handleRename(item.id)}
                                 onKeyDown={e => e.key === 'Enter' && handleRename(item.id)}
                                 className="font-bold text-lg bg-indigo-50 px-2 rounded outline-none w-full"
                               />
                               <button onClick={() => handleRename(item.id)} className="p-1 bg-indigo-500 text-white rounded"><CheckCircle2 size={16}/></button>
                            </div>
                          ) : (
                            <h3 className="font-bold text-lg text-slate-800 truncate cursor-pointer hover:text-indigo-600 transition-colors">
                              {item.fileName}
                            </h3>
                          )}
                          
                          <div className="flex items-center gap-2 mt-2">
                             {item.topicSummary && (
                               <span className="inline-flex items-center text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                 <Tag size={12} className="mr-1" /> #{item.topicSummary.split(' ')[0]}
                               </span>
                             )}
                             <span className="text-xs text-slate-400">{item.questionCount} Soal</span>
                          </div>
                       </div>

                       {/* SCORE & ACTIONS */}
                       <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                          
                          {/* Score Badge */}
                          <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl border ${scoreColor}`}>
                             {item.lastScore !== undefined && item.lastScore !== null ? (
                               <>
                                 <span className="text-xl font-black">{item.lastScore}</span>
                                 <span className="text-[10px] font-bold uppercase">Nilai</span>
                               </>
                             ) : (
                               <span className="text-[10px] font-bold text-center leading-tight">Belum<br/>Main</span>
                             )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex md:flex-col gap-2">
                             <button 
                               onClick={() => onLoadHistory(item)}
                               className="p-2 bg-indigo-600 text-white rounded-xl shadow hover:bg-indigo-700 transition-colors"
                               title="Mainkan"
                             >
                               <Play size={18} fill="currentColor" />
                             </button>

                             <div className="relative">
                               <button 
                                 onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === item.id ? null : item.id); }}
                                 className="p-2 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition-colors"
                               >
                                 <MoreVertical size={18} />
                               </button>

                               {/* Dropdown Menu */}
                               <AnimatePresence>
                                 {activeMenuId === item.id && (
                                   <motion.div 
                                     initial={{ opacity: 0, scale: 0.95, y: 10 }} 
                                     animate={{ opacity: 1, scale: 1, y: 0 }} 
                                     exit={{ opacity: 0, scale: 0.95 }}
                                     transition={{ duration: 0.1 }}
                                     className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
                                     onClick={e => e.stopPropagation()}
                                   >
                                      <div className="p-1">
                                        <button onClick={() => { openEditModal(item); setActiveMenuId(null); }} className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center font-medium">
                                          <Edit3 size={14} className="mr-2" /> Edit Soal
                                        </button>
                                        
                                        {viewMode === 'local' && (
                                          <>
                                            <button onClick={() => { setEditingId(item.id); setTempName(item.fileName); setActiveMenuId(null); }} className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center font-medium">
                                              <Edit2 size={14} className="mr-2" /> Rename
                                            </button>
                                            <button onClick={() => { handleUpload(item); setActiveMenuId(null); }} className="w-full text-left px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center font-medium">
                                              <CloudUpload size={14} className="mr-2" /> Upload Cloud
                                            </button>
                                          </>
                                        )}

                                        {viewMode === 'cloud' && (
                                          <button onClick={() => { handleDownload(item); }} className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center font-medium">
                                            <Download size={14} className="mr-2" /> Simpan ke Local
                                          </button>
                                        )}
                                        
                                        <div className="h-px bg-slate-100 my-1" />
                                        
                                        <button onClick={() => { handleDelete(item.id); setActiveMenuId(null); }} className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg flex items-center font-medium">
                                          <Trash2 size={14} className="mr-2" /> Hapus
                                        </button>
                                      </div>
                                   </motion.div>
                                 )}
                               </AnimatePresence>
                             </div>
                          </div>
                       </div>
                    </div>
                 </motion.div>
               )
            })
          )}
        </AnimatePresence>
      </div>

      {/* EDIT MODAL */}
      <AnimatePresence>
        {quizToEdit && (
          <EditQuizModal 
              quizTitle={quizToEdit.fileName}
              initialQuestions={quizToEdit.questions || []}
              onSave={saveEditedQuestions}
              onClose={() => setQuizToEdit(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
