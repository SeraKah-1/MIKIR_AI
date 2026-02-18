
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Clock, Edit3, Edit2, MoreVertical, Search, RefreshCw, Cloud, HardDrive, Layout, TrendingUp, Zap, Skull, CloudUpload, Play, Trash2, Tag, AlertCircle, CheckCircle2, Download, Book, Folder, FileText, Upload, ChevronRight, Hash, Plus, Ghost } from 'lucide-react';
import { 
  getSavedQuizzes, renameQuiz, deleteQuiz,
  fetchCloudQuizzes, getStorageProvider, uploadToCloud, deleteFromCloud,
  updateLocalQuizQuestions, updateCloudQuizQuestions, downloadFromCloud,
  saveToLibrary, getLibraryItems, deleteLibraryItem,
  getGraveyard, removeFromGraveyard // NEW IMPORTS
} from '../services/storageService';
import { extractPdfText } from '../services/groqService'; 
import { EditQuizModal } from './EditQuizModal';
import { QuizMode, LibraryItem, Question } from '../types';

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

// --- WORKSPACE COMPONENT (NOTION-LIKE) ---
export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onLoadHistory }) => {
  const [activeTab, setActiveTab] = useState<'library' | 'quizzes' | 'graveyard'>('library');
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [quizHistory, setQuizHistory] = useState<any[]>([]);
  const [graveyardItems, setGraveyardItems] = useState<any[]>([]); // New State
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  
  // Quiz Specific States
  const [viewMode, setViewMode] = useState<'local' | 'cloud'>('local');
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<'all' | 'survival' | 'low_score' | 'new'>('all');
  const [activeMenuId, setActiveMenuId] = useState<string | number | null>(null);
  const [quizToEdit, setQuizToEdit] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [tempName, setTempName] = useState("");

  useEffect(() => {
    refreshAll();
  }, []);

  const refreshAll = async () => {
    setIsLoading(true);
    await Promise.all([refreshLibrary(), refreshQuizzes(), refreshGraveyard()]);
    setIsLoading(false);
  };

  const refreshLibrary = async () => {
    const items = await getLibraryItems();
    setLibraryItems(items);
  };

  const refreshQuizzes = async () => {
    if (viewMode === 'local') {
      const data = await getSavedQuizzes();
      setQuizHistory(data);
    } else {
      const data = await fetchCloudQuizzes();
      setQuizHistory(data);
    }
  };

  const refreshGraveyard = () => {
     setGraveyardItems(getGraveyard());
  };

  useEffect(() => { refreshQuizzes(); }, [viewMode]);

  // --- LIBRARY ACTIONS ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const files = Array.from(e.target.files) as File[];
    
    setIsProcessingFile(true);
    let successCount = 0;

    for (const file of files) {
       try {
         let content = "";
         let type: 'pdf' | 'text' = 'text';
         
         if (file.name.endsWith('.pdf')) {
            content = await extractPdfText(file);
            type = 'pdf';
         } else {
            content = await file.text();
         }
         
         await saveToLibrary(file.name, content, type);
         successCount++;
       } catch (err) {
         console.error("Failed to process", file.name, err);
       }
    }
    
    setIsProcessingFile(false);
    alert(`Berhasil menyimpan ${successCount} materi ke Library!`);
    refreshLibrary();
  };

  const handleDeleteLibraryItem = async (id: string | number) => {
    if (confirm("Hapus materi ini dari Library?")) {
      await deleteLibraryItem(id);
      refreshLibrary();
    }
  };

  // --- QUIZ ACTIONS ---
  const handleDeleteQuiz = async (id: number | string) => {
    if (confirm("Hapus kuis ini?")) {
      if (viewMode === 'local') await deleteQuiz(id);
      else await deleteFromCloud(id);
      refreshQuizzes();
    }
  };

  // --- GRAVEYARD ACTIONS ---
  const handleResurrect = (q: Question) => {
     // Create a mini quiz with just this question to let user retry
     onLoadHistory({
        id: Date.now(),
        fileName: "Latihan Kuburan Soal",
        questions: [q],
        mode: QuizMode.STANDARD,
        questionCount: 1
     });
     // We remove it from graveyard immediately or user can remove manually
     // Let's remove it if they click "trash", but "play" just plays it.
  };

  const handleBanish = (id: number) => {
     removeFromGraveyard(id);
     refreshGraveyard();
  };

  const filteredQuizzes = useMemo(() => {
    return quizHistory.filter(item => {
      if (searchQuery && !item.fileName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (activeFilter === 'survival' && item.mode !== QuizMode.SURVIVAL) return false;
      if (activeFilter === 'low_score' && (item.lastScore === null || item.lastScore >= 60)) return false;
      if (activeFilter === 'new' && item.lastScore !== null && item.lastScore !== undefined) return false;
      return true;
    });
  }, [quizHistory, searchQuery, activeFilter]);

  return (
    <div className="max-w-6xl mx-auto pt-4 pb-24 px-4 min-h-[90vh] text-theme-text flex flex-col md:flex-row gap-6">
      
      {/* SIDEBAR NAVIGATION (NOTION STYLE) */}
      <div className="w-full md:w-64 shrink-0 space-y-6">
         <div className="bg-theme-glass border border-theme-border rounded-2xl p-4 shadow-sm sticky top-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Workspace</h2>
            
            <nav className="space-y-1">
               <button 
                 onClick={() => setActiveTab('library')}
                 className={`w-full flex items-center px-3 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'library' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
               >
                 <Book size={18} className="mr-3 text-indigo-500" /> Library Materi
               </button>
               <button 
                 onClick={() => setActiveTab('quizzes')}
                 className={`w-full flex items-center px-3 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'quizzes' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
               >
                 <History size={18} className="mr-3 text-pink-500" /> Riwayat Quiz
               </button>
               <button 
                 onClick={() => { setActiveTab('graveyard'); refreshGraveyard(); }}
                 className={`w-full flex items-center px-3 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'graveyard' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
               >
                 <Ghost size={18} className={`mr-3 ${activeTab === 'graveyard' ? 'text-white' : 'text-slate-800'}`} /> Kuburan Soal
                 {graveyardItems.length > 0 && <span className="ml-auto bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{graveyardItems.length}</span>}
               </button>
            </nav>

            <div className="mt-8">
               <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Quick Stats</h2>
               <div className="bg-white/50 rounded-xl p-3 text-xs space-y-2">
                  <div className="flex justify-between"><span>Materi:</span> <span className="font-bold">{libraryItems.length}</span></div>
                  <div className="flex justify-between"><span>Quiz:</span> <span className="font-bold">{quizHistory.length}</span></div>
               </div>
            </div>
         </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 bg-theme-glass border border-theme-border rounded-[2rem] p-6 md:p-8 min-h-[500px] shadow-xl relative overflow-hidden">
         
         {/* --- LIBRARY VIEW --- */}
         {activeTab === 'library' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
               <div className="flex justify-between items-center mb-6 border-b border-slate-200/60 pb-4">
                  <div>
                     <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Folder size={24} className="text-indigo-500"/> Library Materi</h1>
                     <p className="text-sm text-slate-500">Gudang pengetahuan untuk bahan quiz.</p>
                  </div>
                  <button onClick={() => document.getElementById('lib-upload')?.click()} disabled={isProcessingFile} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-indigo-700 transition-all flex items-center">
                     {isProcessingFile ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Upload size={16} className="mr-2" />}
                     Upload Materi
                  </button>
                  <input type="file" id="lib-upload" multiple className="hidden" accept=".pdf,.txt,.md" onChange={handleFileUpload} />
               </div>

               {libraryItems.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl">
                     <Book size={48} className="mx-auto text-slate-300 mb-4" />
                     <p className="text-slate-500 font-medium">Library masih kosong.</p>
                     <p className="text-xs text-slate-400 mt-1">Upload PDF/Catatan agar bisa dipakai berulang kali.</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 gap-3">
                     {libraryItems.map((item) => (
                        <div key={item.id} className="group flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:shadow-md hover:border-indigo-200 transition-all">
                           <div className="flex items-center gap-4 overflow-hidden">
                              <div className={`p-3 rounded-xl shrink-0 ${item.type === 'pdf' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                 <FileText size={20} />
                              </div>
                              <div className="min-w-0">
                                 <h3 className="font-bold text-slate-700 truncate">{item.title}</h3>
                                 <p className="text-xs text-slate-400 flex items-center gap-2">
                                    <span className="uppercase font-bold tracking-wider text-[9px]">{item.type}</span>
                                    <span>•</span>
                                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                 </p>
                              </div>
                           </div>
                           <button onClick={() => handleDeleteLibraryItem(item.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 size={18} />
                           </button>
                        </div>
                     ))}
                  </div>
               )}
            </motion.div>
         )}

         {/* --- QUIZZES VIEW --- */}
         {activeTab === 'quizzes' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-200/60 pb-4">
                  <div>
                     <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><History size={24} className="text-pink-500"/> Riwayat Quiz</h1>
                     <p className="text-sm text-slate-500">Arsip nilai dan soal latihan.</p>
                  </div>
                  
                  {/* View Switcher */}
                  <div className="bg-slate-100 p-1 rounded-xl flex shadow-inner shrink-0">
                     <button onClick={() => setViewMode('local')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'local' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}>Local</button>
                     <button onClick={() => setViewMode('cloud')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'cloud' ? 'bg-white shadow text-emerald-600' : 'text-slate-400'}`}>Cloud</button>
                  </div>
               </div>

               {/* Filters */}
               <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {['all', 'survival', 'low_score', 'new'].map(f => (
                     <button key={f} onClick={() => setActiveFilter(f as any)} className={`px-3 py-1 rounded-full text-xs font-bold border capitalize ${activeFilter === f ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                        {f.replace('_', ' ')}
                     </button>
                  ))}
               </div>

               <div className="space-y-3">
                  {filteredQuizzes.length === 0 ? (
                     <div className="text-center py-10 text-slate-400 text-sm">Tidak ada data quiz.</div>
                  ) : (
                     filteredQuizzes.map((quiz) => {
                        const scoreColor = getScoreColor(quiz.lastScore);
                        return (
                           <div key={quiz.id} onClick={() => onLoadHistory(quiz)} className="bg-white border border-slate-200 p-4 rounded-2xl hover:border-indigo-300 hover:shadow-lg transition-all cursor-pointer flex items-center justify-between group">
                              <div className="flex items-center gap-4 overflow-hidden">
                                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border ${scoreColor}`}>
                                    {quiz.lastScore ?? "-"}
                                 </div>
                                 <div className="min-w-0">
                                    <h3 className="font-bold text-slate-700 truncate">{quiz.fileName}</h3>
                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                       <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">{quiz.mode}</span>
                                       <span>{quiz.questionCount} Soal</span>
                                       <span>•</span>
                                       <span>{new Date(quiz.date).toLocaleDateString()}</span>
                                    </div>
                                 </div>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteQuiz(quiz.id); }} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                 <Trash2 size={18} />
                              </button>
                           </div>
                        )
                     })
                  )}
               </div>
            </motion.div>
         )}

         {/* --- GRAVEYARD VIEW --- */}
         {activeTab === 'graveyard' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex justify-between items-center mb-6 border-b border-slate-200/60 pb-4">
                  <div>
                     <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Ghost size={24} className="text-slate-800"/> Kuburan Soal</h1>
                     <p className="text-sm text-slate-500">Tempat soal-soal yang pernah kamu jawab salah.</p>
                  </div>
               </div>

               {graveyardItems.length === 0 ? (
                  <div className="text-center py-20 bg-slate-50 rounded-3xl border border-slate-100">
                     <Ghost size={48} className="mx-auto text-slate-300 mb-4 animate-bounce" />
                     <p className="text-slate-600 font-bold">Kuburan Kosong!</p>
                     <p className="text-xs text-slate-400 mt-1">Hebat, kamu belum melakukan kesalahan fatal.</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 gap-4">
                     {graveyardItems.map((q) => (
                        <div key={q.id} className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-4">
                           <div className="flex-1">
                              <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-1 rounded font-bold uppercase tracking-wider mb-2 inline-block">Salah pada {new Date(q.buriedAt || Date.now()).toLocaleDateString()}</span>
                              <p className="font-bold text-slate-800 mb-2">{q.text}</p>
                              <p className="text-sm text-slate-500 bg-slate-50 p-2 rounded italic border border-slate-100">
                                 Kunci: <span className="font-bold text-emerald-600">{q.type === 'FILL_BLANK' ? q.correctAnswer : q.options[q.correctIndex]}</span>
                              </p>
                           </div>
                           <div className="flex flex-row md:flex-col gap-2 shrink-0 justify-center">
                              <button onClick={() => handleResurrect(q)} className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20">
                                 <RefreshCw size={14} className="mr-2" /> Coba Lagi
                              </button>
                              <button onClick={() => handleBanish(q.id)} className="flex items-center justify-center px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-200">
                                 <Trash2 size={14} className="mr-2" /> Hapus
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
               )}
            </motion.div>
         )}

      </div>
    </div>
  );
};
