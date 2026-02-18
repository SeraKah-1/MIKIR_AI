
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, CheckCircle2, Circle, Shuffle, Play, Layers, Sparkles } from 'lucide-react';
import { getSavedQuizzes } from '../services/storageService';
import { GlassButton } from './GlassButton';
import { Question } from '../types';
import { transformToMixed } from '../services/questionTransformer';

interface VirtualRoomProps {
  onStartMix: (questions: Question[]) => void;
}

export const VirtualRoom: React.FC<VirtualRoomProps> = ({ onStartMix }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isVariedMode, setIsVariedMode] = useState(false);
  
  useEffect(() => {
    const loadData = async () => {
      const data = await getSavedQuizzes();
      setHistory(data);
    };
    loadData();
  }, []);

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleStart = () => {
    const selectedQuizzes = history.filter(h => selectedIds.includes(h.id));
    let combinedQuestions: Question[] = [];
    
    // Combine questions
    selectedQuizzes.forEach(quiz => {
       if (Array.isArray(quiz.questions)) {
          combinedQuestions = [...combinedQuestions, ...quiz.questions];
       }
    });

    // Shuffle questions
    combinedQuestions = combinedQuestions.sort(() => Math.random() - 0.5);

    // Apply Transformation if Mix Mode is on
    if (isVariedMode) {
       combinedQuestions = transformToMixed(combinedQuestions);
    }

    // Re-index IDs to avoid conflict
    const finalQuestions = combinedQuestions.map((q, idx) => ({
      ...q,
      id: idx + 1
    }));

    onStartMix(finalQuestions);
  };

  const totalQuestions = history
    .filter(h => selectedIds.includes(h.id))
    .reduce((acc, curr) => acc + (curr.questionCount || 0), 0);

  return (
    <div className="max-w-4xl mx-auto pt-8 pb-24 px-4 min-h-[80vh]">
      <div className="text-center mb-10">
         <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
           <h1 className="text-3xl font-bold text-theme-text flex items-center justify-center">
             <Gamepad2 className="mr-3 text-theme-primary" size={32} /> Virtual Room
           </h1>
           <p className="text-theme-muted mt-2">
             Pilih beberapa kuis lama untuk membuat <span className="text-theme-primary font-bold">Ujian Campuran (Mixer)</span>.
           </p>
         </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* LIST SECTION */}
         <div className="md:col-span-2 space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {history.length === 0 && (
               <div className="text-center p-10 border-2 border-dashed border-theme-border rounded-3xl text-theme-muted">
                  Belum ada riwayat kuis untuk dicampur.
               </div>
            )}
            
            {history.map((quiz, idx) => {
               const isSelected = selectedIds.includes(quiz.id);
               return (
                 <motion.div 
                   key={quiz.id}
                   initial={{ x: -20, opacity: 0 }}
                   animate={{ x: 0, opacity: 1 }}
                   transition={{ delay: idx * 0.05 }}
                   onClick={() => toggleSelection(quiz.id)}
                   className={`
                     relative p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between
                     ${isSelected 
                       ? 'bg-theme-primary/10 border-theme-primary shadow-md ring-1 ring-theme-primary' 
                       : 'bg-theme-glass border-transparent hover:bg-white hover:border-theme-border'}
                   `}
                 >
                    <div className="flex items-center space-x-4">
                       <div className={`
                         p-3 rounded-xl transition-colors
                         ${isSelected ? 'bg-theme-primary text-white' : 'bg-slate-100 text-slate-400'}
                       `}>
                          <Layers size={20} />
                       </div>
                       <div>
                          <h3 className={`font-semibold text-sm ${isSelected ? 'text-theme-primary' : 'text-slate-700'}`}>
                            {quiz.fileName}
                          </h3>
                          <p className="text-xs text-slate-500">{quiz.questionCount} Soal • {new Date(quiz.date).toLocaleDateString()}</p>
                       </div>
                    </div>

                    <div className="pr-2">
                       {isSelected 
                         ? <CheckCircle2 className="text-theme-primary" size={24} />
                         : <Circle className="text-slate-300" size={24} />
                       }
                    </div>
                 </motion.div>
               )
            })}
         </div>

         {/* ACTION PANEL */}
         <div className="md:col-span-1">
            <div className="bg-theme-glass backdrop-blur-xl border border-theme-border p-6 rounded-3xl shadow-xl sticky top-6">
               <h3 className="text-lg font-bold text-theme-text mb-4 flex items-center">
                 <Shuffle size={18} className="mr-2" /> Summary
               </h3>
               
               <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-sm text-theme-muted">
                     <span>Quiz Dipilih</span>
                     <span className="font-bold text-theme-text">{selectedIds.length}</span>
                  </div>
                  <div className="flex justify-between text-sm text-theme-muted">
                     <span>Total Soal</span>
                     <span className="font-bold text-theme-text">{totalQuestions}</span>
                  </div>
               </div>

               {/* VARIATION TOGGLE */}
               <div 
                 onClick={() => setIsVariedMode(!isVariedMode)}
                 className={`p-3 rounded-xl border cursor-pointer transition-all mb-6 flex items-center justify-between ${isVariedMode ? 'bg-fuchsia-50 border-fuchsia-300' : 'bg-white/50 border-transparent hover:border-slate-200'}`}
               >
                  <div className="flex items-center">
                     <div className={`p-2 rounded-lg mr-2 ${isVariedMode ? 'bg-fuchsia-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                        <Sparkles size={16} />
                     </div>
                     <div>
                        <span className={`block text-xs font-bold ${isVariedMode ? 'text-fuchsia-700' : 'text-slate-500'}`}>Mode Variasi</span>
                        <span className="text-[9px] text-slate-400">Ubah jadi T/F & Isian</span>
                     </div>
                  </div>
                  <div className={`w-8 h-5 rounded-full p-0.5 transition-colors ${isVariedMode ? 'bg-fuchsia-500' : 'bg-slate-300'}`}>
                     <motion.div className="w-4 h-4 bg-white rounded-full shadow-sm" animate={{ x: isVariedMode ? 12 : 0 }} />
                  </div>
               </div>

               <div className="space-y-3">
                 <GlassButton 
                   fullWidth 
                   onClick={handleStart} 
                   disabled={selectedIds.length < 2}
                   className={`${selectedIds.length >= 2 ? 'bg-theme-primary text-white hover:opacity-90' : 'opacity-50 cursor-not-allowed'}`}
                 >
                    <Play size={18} className="mr-2" /> Start Mixer
                 </GlassButton>
                 
                 {selectedIds.length < 2 && (
                    <p className="text-[10px] text-center text-slate-400 italic">
                       Pilih minimal 2 kuis untuk memulai.
                    </p>
                 )}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
