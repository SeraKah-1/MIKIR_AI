
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Download, RotateCcw, Share2, Layers, FileJson, Activity, Trophy, Brain, Zap, Target, BookOpen, PlayCircle, Trash2, PlusCircle, ArrowRight, Shuffle, Printer, FileText } from 'lucide-react';
import confetti from 'canvas-confetti';
import { QuizResult, Question, SkillAnalysis } from '../types';
import { GlassButton } from './GlassButton';
import { useGameSound } from '../hooks/useGameSound';
import { FlashcardScreen } from './FlashcardScreen';
import { getStorageProvider } from '../services/storageService';
// Import html2pdf
import html2pdf from 'html2pdf.js';

interface ResultScreenProps {
  result: QuizResult;
  questions: Question[]; 
  onReset: () => void;
  onRetryMistakes: () => void;
  onRetryAll: () => void;
  onDelete?: () => void;
  onAddMore?: (count: number) => void;
  onRemix?: (questions: Question[]) => void;
}

const SkillBar: React.FC<{ label: string; score: number; icon: any; color: string }> = ({ label, score, icon: Icon, color }) => (
  <div className="mb-4">
    <div className="flex justify-between items-center mb-1">
       <div className="flex items-center text-slate-600 text-sm font-medium">
         <Icon size={14} className={`mr-2 ${color}`} /> {label}
       </div>
       <span className={`text-xs font-bold ${color}`}>{score}%</span>
    </div>
    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
      <motion.div 
         initial={{ width: 0 }}
         animate={{ width: `${score}%` }}
         transition={{ duration: 1, ease: "easeOut" }}
         className={`h-full rounded-full bg-current ${color}`}
         style={{ backgroundColor: 'currentColor' }}
      />
    </div>
  </div>
);

// --- CHEAT SHEET COMPONENT (INTERNAL) ---
const CheatSheetModal: React.FC<{ questions: Question[]; onClose: () => void }> = ({ questions, onClose }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadPDF = () => {
    if (!contentRef.current) return;
    setIsGenerating(true);

    const element = contentRef.current;
    const opt = {
      margin:       [10, 10, 10, 10], // Top, Left, Bottom, Right
      filename:     `Mikir-Rangkuman-${new Date().toISOString().split('T')[0]}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Use html2pdf from import
    html2pdf().set(opt).from(element).save().then(() => {
       setIsGenerating(false);
       onClose();
    }).catch((err: any) => {
       console.error("PDF Gen Error:", err);
       setIsGenerating(false);
       alert("Gagal membuat PDF. Coba lagi.");
    });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/90 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-4xl h-[90vh] rounded-3xl flex flex-col shadow-2xl overflow-hidden relative">
         
         {/* Controls Header */}
         <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-20">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               <FileText className="text-indigo-600" /> Preview Rangkuman
            </h2>
            <div className="flex gap-2">
               <button onClick={onClose} className="px-4 py-2 text-slate-500 text-sm hover:bg-slate-200 rounded-lg font-medium">Batal</button>
               <button 
                 onClick={handleDownloadPDF} 
                 disabled={isGenerating}
                 className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center shadow-lg hover:bg-indigo-700 disabled:opacity-50"
               >
                  {isGenerating ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Download size={16} className="mr-2" />}
                  {isGenerating ? "Menyusun PDF..." : "Download PDF"}
               </button>
            </div>
         </div>

         {/* Scrollable Preview Area */}
         <div className="flex-1 overflow-y-auto bg-slate-200 p-8 flex justify-center">
            {/* THE A4 PAPER TARGET */}
            <div 
               id="cheat-sheet-content" 
               ref={contentRef}
               className="bg-white shadow-2xl w-full max-w-[210mm] min-h-[297mm] p-[15mm] text-slate-900"
               style={{ fontFamily: 'Inter, sans-serif' }}
            >
               {/* Document Header */}
               <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
                  <div>
                     <h1 className="text-3xl font-black tracking-tight text-black mb-1">RANGKUMAN MATERI</h1>
                     <p className="text-sm font-medium text-slate-600">Generated by Mikir AI • {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div className="text-right">
                     <div className="text-4xl font-black text-indigo-600 tracking-tighter">M.</div>
                  </div>
               </div>

               {/* Questions Grid */}
               <div className="space-y-6">
                  {questions.map((q, idx) => (
                     <div key={idx} className="break-inside-avoid border-b border-slate-200 pb-4 last:border-0">
                        <div className="flex gap-3">
                           <span className="font-bold text-slate-400 w-6 shrink-0">{idx + 1}.</span>
                           <div className="flex-1">
                              <p className="font-bold text-slate-900 mb-2 text-sm leading-snug">{q.text}</p>
                              
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                 <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase tracking-wide">Jawaban:</span>
                                 <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                    {q.type === 'FILL_BLANK' ? q.correctAnswer : q.options[q.correctIndex]}
                                 </span>
                              </div>

                              <p className="text-xs text-slate-600 leading-relaxed italic bg-slate-50 p-2 rounded border-l-2 border-indigo-300">
                                 {q.explanation}
                              </p>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>

               {/* Footer */}
               <div className="mt-8 pt-4 border-t border-slate-300 text-center">
                  <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Keep Learning • Stay Curious</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export const ResultScreen: React.FC<ResultScreenProps> = ({ result, questions, onReset, onRetryMistakes, onRetryAll, onDelete, onAddMore, onRemix }) => {
  const percentage = Math.round((result.correctCount / result.totalQuestions) * 100);
  const { playFanfare, playClick } = useGameSound();
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false); 
  const [analysis, setAnalysis] = useState<SkillAnalysis | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addCount, setAddCount] = useState<string>("10");
  
  let gradeColor = "text-indigo-600";
  let gradeMessage = "Luar Biasa";
  
  if (percentage < 60) {
    gradeColor = "text-amber-600";
    gradeMessage = "Perlu Latihan Lagi";
  } else if (percentage < 80) {
    gradeColor = "text-emerald-600";
    gradeMessage = "Bagus";
  }

  const wrongAnswersCount = result.totalQuestions - result.correctCount;

  useEffect(() => {
    if (percentage >= 60) playFanfare();
    if (percentage >= 70) {
      confetti({ particleCount: 50, origin: { y: 0.6 } });
    }
    calculateSkills();
  }, [percentage, playFanfare]);

  const calculateSkills = () => {
     const categorized = questions.map(q => {
        let inferredType = 'Application';
        if (q.difficulty === 'Easy') inferredType = 'Memory';
        else if (q.difficulty === 'Hard') inferredType = 'Logic';
        else {
           if (q.text.length < 60) inferredType = 'Memory';
           else if (q.text.length > 150) inferredType = 'Logic';
           else inferredType = 'Application';
        }
        return { ...q, inferredType };
     });

     const getScoreByType = (type: string) => {
       const subset = categorized.filter(q => q.inferredType === type);
       if (subset.length === 0) return percentage;
       
       const correct = subset.filter(q => {
         const ans = result.answers.find(a => a.questionId === q.id);
         return ans && ans.isCorrect;
       }).length;
       return Math.round((correct / subset.length) * 100);
     };

     const memoryScore = getScoreByType('Memory');
     const logicScore = getScoreByType('Logic');
     const appScore = getScoreByType('Application');
     
     let focusScore = 80;
     const memoryMistakes = categorized.filter(q => q.inferredType === 'Memory').filter(q => {
         const ans = result.answers.find(a => a.questionId === q.id);
         return ans && !ans.isCorrect;
     }).length;
     focusScore -= (memoryMistakes * 15);
     const logicWins = categorized.filter(q => q.inferredType === 'Logic').filter(q => {
         const ans = result.answers.find(a => a.questionId === q.id);
         return ans && ans.isCorrect;
     }).length;
     focusScore += (logicWins * 5);
     
     focusScore = Math.max(0, Math.min(100, focusScore));

     let feedback = "";
     if (logicScore < memoryScore - 20) feedback = "Kekuatanmu ada di hafalan fakta, tapi perlu latihan analisis soal panjang.";
     else if (memoryScore < logicScore - 20) feedback = "Logikamu tajam! Tapi hati-hati, kamu sering melewatkan definisi dasar.";
     else if (focusScore < 60) feedback = "Kamu banyak kehilangan poin di soal-soal pendek. Kurangi terburu-buru.";
     else if (percentage > 90) feedback = "Performa sempurna di semua aspek. Kamu siap untuk level selanjutnya!";
     else feedback = "Kemampuanmu seimbang. Tingkatkan akurasi di semua lini.";

     setAnalysis({
       memory: memoryScore,
       application: appScore,
       logic: logicScore,
       focus: focusScore,
       analysis: feedback
     });
  };

  const handleExportJSON = () => {
    playClick();
    const exportData = { questions, meta: { score: percentage } };
    const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Mikir-Export-${Date.now()}.glassquiz`;
    a.click();
  };

  const handleAddMoreSubmit = () => {
    const val = parseInt(addCount);
    if (isNaN(val) || val < 1 || val > 50) {
      alert("Masukkan jumlah soal antara 1 - 50");
      return;
    }
    setIsAdding(true);
    if (onAddMore) onAddMore(val);
  };

  const handleRemix = () => {
     if (onRemix) onRemix(questions);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-20">
      
      {/* HEADER SUMMARY */}
      <div className="text-center mb-10">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-block relative"
        >
          <svg className="w-48 h-48 transform -rotate-90 drop-shadow-2xl">
              <circle className="text-white/50" strokeWidth="16" stroke="currentColor" fill="transparent" r="80" cx="96" cy="96" />
              <motion.circle
                className={percentage < 60 ? "text-amber-400" : percentage < 80 ? "text-emerald-400" : "text-indigo-500"}
                strokeWidth="16"
                strokeDasharray={502}
                strokeDashoffset={502 - (502 * percentage) / 100}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="80"
                cx="96"
                cy="96"
                initial={{ strokeDashoffset: 502 }}
                animate={{ strokeDashoffset: 502 - (502 * percentage) / 100 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
          </svg>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="text-5xl font-bold text-slate-800 tracking-tighter">{percentage}%</div>
            <div className={`text-sm font-bold uppercase tracking-widest mt-1 ${gradeColor}`}>{gradeMessage}</div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* LEFT: STATS */}
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/40 backdrop-blur-xl border border-white/50 rounded-[2rem] p-8 shadow-xl"
        >
          <h3 className="text-slate-500 font-bold uppercase text-xs tracking-widest mb-6 flex items-center">
            <Activity size={14} className="mr-2" /> Analisis Kemampuan
          </h3>
          
          {analysis ? (
            <div className="space-y-2">
              <SkillBar label="Hafalan & Fakta" score={analysis.memory} icon={BookOpen} color="text-indigo-500" />
              <SkillBar label="Logika & Analisis" score={analysis.logic} icon={Brain} color="text-pink-500" />
              <SkillBar label="Penerapan" score={analysis.application} icon={Zap} color="text-amber-500" />
              <SkillBar label="Fokus & Teliti" score={analysis.focus} icon={Target} color="text-emerald-500" />
              
              <div className="mt-6 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                <p className="text-xs text-indigo-800 italic leading-relaxed">
                  "{analysis.analysis}"
                </p>
              </div>
            </div>
          ) : (
            <div className="text-slate-400 text-sm animate-pulse">Menghitung statistik...</div>
          )}
        </motion.div>

        {/* RIGHT: ACTION BUTTONS */}
        <motion.div 
           initial={{ x: 20, opacity: 0 }}
           animate={{ x: 0, opacity: 1 }}
           transition={{ delay: 0.3 }}
           className="flex flex-col justify-center space-y-4"
        >
          {/* Add Questions Section */}
          {onAddMore && !isAdding && (
             <div className="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 p-4 rounded-2xl border border-violet-200/50">
                <p className="text-xs font-bold text-violet-600 mb-2 text-center uppercase tracking-wide">Kurang Puas? Tambah Soal!</p>
                <div className="flex gap-2">
                   <div className="relative flex-1">
                      <input 
                        type="number" 
                        min="1" 
                        max="50" 
                        value={addCount} 
                        onChange={(e) => setAddCount(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-violet-200 text-center font-bold text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-violet-400 font-bold pointer-events-none">Soal</span>
                   </div>
                   <button onClick={handleAddMoreSubmit} className="bg-violet-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-violet-700 flex items-center justify-center transition-colors">
                      <PlusCircle size={14} className="mr-1" /> Generate
                   </button>
                </div>
             </div>
          )}
          
          {isAdding && (
             <div className="bg-white/50 p-4 rounded-2xl border border-indigo-100 text-center">
                <RefreshCw className="animate-spin mx-auto text-indigo-500 mb-2" />
                <p className="text-xs font-bold text-indigo-600">Sedang membuat soal tambahan...</p>
             </div>
          )}

          {wrongAnswersCount > 0 && (
            <GlassButton onClick={onRetryMistakes} variant="danger" className="flex justify-center py-4">
              <RotateCcw size={18} className="mr-2" /> Perbaiki {wrongAnswersCount} Kesalahan
            </GlassButton>
          )}

          <div className="flex gap-2">
             <GlassButton onClick={onRetryAll} variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100 flex-1 flex justify-center py-4 text-xs">
               <PlayCircle size={18} className="mr-2" /> Ulangi
             </GlassButton>
             
             {onRemix && (
               <GlassButton onClick={handleRemix} variant="secondary" className="bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100 flex-1 flex justify-center py-4 text-xs">
                 <Shuffle size={18} className="mr-2" /> Remix (Variasi)
               </GlassButton>
             )}
          </div>
          
          {/* CHEAT SHEET BUTTON (FEATURE 3) - NOW PDF */}
          <GlassButton onClick={() => setShowCheatSheet(true)} variant="secondary" className="bg-teal-50 text-teal-700 border-teal-100 flex justify-center py-4">
             <Download size={18} className="mr-2" /> Download Rangkuman (PDF)
          </GlassButton>

          <GlassButton onClick={() => setShowFlashcards(true)} variant="secondary" className="bg-white/60 text-indigo-600 border-indigo-100 flex justify-center py-4">
            <Layers size={18} className="mr-2" /> Review Mode (SRS)
          </GlassButton>

          <GlassButton onClick={onReset} variant="primary" className="flex justify-center py-4">
            <RefreshCw size={18} className="mr-2" /> Buat Quiz Baru
          </GlassButton>
           
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200/50">
             <button onClick={handleExportJSON} className="flex items-center justify-center p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors">
               <FileJson size={14} className="mr-2" /> Save JSON
             </button>
             {onDelete && (
                <button onClick={onDelete} className="flex items-center justify-center p-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-colors">
                  <Trash2 size={14} className="mr-2" /> Buang Quiz
                </button>
             )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showFlashcards && <FlashcardScreen questions={questions} onClose={() => setShowFlashcards(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showCheatSheet && <CheatSheetModal questions={questions} onClose={() => setShowCheatSheet(false)} />}
      </AnimatePresence>
    </div>
  );
};
