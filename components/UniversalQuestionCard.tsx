
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Lightbulb, Type, ArrowRight, ToggleLeft, HelpCircle } from 'lucide-react';
import { Question } from '../types';
import { useGameSound } from '../hooks/useGameSound';

interface UniversalCardProps {
  question: Question;
  isAnswered: boolean;
  userAnswer: any; // index (number) or text (string)
  onAnswer: (answer: any, isCorrect: boolean) => void;
  onNext: () => void;
}

export const UniversalQuestionCard: React.FC<UniversalCardProps> = ({
  question, isAnswered, userAnswer, onAnswer, onNext
}) => {
  const { playHover } = useGameSound();
  const [textInput, setTextInput] = useState("");

  // --- RENDERER: MULTIPLE CHOICE ---
  const renderMCQ = () => (
    <div className="grid grid-cols-1 gap-3">
      {question.options.map((option, idx) => {
        const isSelected = userAnswer === idx;
        const isCorrect = question.correctIndex === idx;
        
        let containerStyle = "bg-white/40 border-white/50 text-slate-600 hover:bg-white/60 hover:border-white hover:shadow-md hover:-translate-y-0.5";
        let badgeStyle = "bg-white/50 text-slate-400 border-slate-200";
        
        if (isAnswered) {
            if (isCorrect) {
                containerStyle = "bg-emerald-500/10 border-emerald-500/50 text-emerald-800 ring-1 ring-emerald-500/50";
                badgeStyle = "bg-emerald-500 text-white border-emerald-500";
            } else if (isSelected) {
                containerStyle = "bg-rose-500/10 border-rose-500/50 text-rose-800 opacity-80";
                badgeStyle = "bg-rose-500 text-white border-rose-500";
            } else {
                containerStyle = "bg-slate-100/30 border-transparent text-slate-400 opacity-50 blur-[0.5px]";
                badgeStyle = "bg-slate-200/50 text-slate-300";
            }
        }

        return (
          <motion.button
            key={idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => {
                if (!isAnswered) onAnswer(idx, idx === question.correctIndex);
            }}
            onMouseEnter={!isAnswered ? playHover : undefined}
            disabled={isAnswered}
            className={`
                relative w-full p-4 rounded-2xl border-2 text-left transition-all duration-300 group
                ${containerStyle}
            `}
          >
            <div className="flex items-start gap-4">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center border text-sm font-bold shrink-0 transition-colors ${badgeStyle}`}>
                    {['A','B','C','D'][idx]}
                </span>
                <span className="text-base md:text-lg font-medium leading-tight flex-1 py-0.5">
                    {option}
                </span>
                {isAnswered && isCorrect && <Check className="text-emerald-500 shrink-0" size={24} />}
                {isAnswered && isSelected && !isCorrect && <X className="text-rose-500 shrink-0" size={24} />}
            </div>
            
            {/* Keyboard Hint */}
            {!isAnswered && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-20 transition-opacity">
                    <span className="text-[10px] font-bold border border-slate-800 px-1.5 py-0.5 rounded text-slate-800">
                        {idx + 1}
                    </span>
                </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );

  // --- RENDERER: TRUE / FALSE ---
  const renderTrueFalse = () => (
    <div className="mt-4">
       <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-200/30 rounded-2xl p-8 text-center mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-purple-400"></div>
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-3">Pernyataan</p>
          <h3 className="text-xl md:text-2xl font-bold text-slate-700 leading-snug">"{question.proposedAnswer}"</h3>
       </div>

       <div className="flex gap-4 h-36">
         {[
           { label: "Benar", val: 0, color: "emerald", icon: Check, hotkey: "1" },
           { label: "Salah", val: 1, color: "rose", icon: X, hotkey: "2" }
         ].map((opt) => {
            const isCorrect = question.correctIndex === opt.val;
            const isSelected = userAnswer === opt.val;
            
            let cardClass = "bg-white/60 border-white/50 text-slate-400 hover:bg-white hover:border-white hover:shadow-lg hover:-translate-y-1";
            
            if (isAnswered) {
                if (isCorrect) cardClass = "bg-emerald-500 text-white border-emerald-500 shadow-xl scale-105 ring-4 ring-emerald-200";
                else if (isSelected && !isCorrect) cardClass = "bg-rose-500 text-white border-rose-500 opacity-50 scale-95";
                else cardClass = "opacity-30 blur-sm";
            }

            return (
               <button
                 key={opt.label}
                 disabled={isAnswered}
                 onClick={() => onAnswer(opt.val, isCorrect)}
                 className={`relative flex-1 rounded-3xl border-2 flex flex-col items-center justify-center transition-all duration-300 ${cardClass}`}
               >
                  <div className={`p-3 rounded-full mb-3 ${isAnswered ? 'bg-white/20 text-white' : `bg-${opt.color}-100 text-${opt.color}-500`}`}>
                     <opt.icon size={32} />
                  </div>
                  <span className="text-2xl font-bold">{opt.label}</span>
                  {!isAnswered && <span className="absolute top-4 right-4 text-[10px] font-bold opacity-30 border px-1.5 rounded hidden md:block">{opt.hotkey}</span>}
               </button>
            )
         })}
      </div>
    </div>
  );

  // --- RENDERER: FILL IN THE BLANK ---
  const handleTextSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!textInput.trim() || isAnswered) return;
      
      const cleanInput = textInput.trim().toLowerCase();
      const cleanAnswer = question.correctAnswer?.trim().toLowerCase() || "";
      const isCorrect = cleanInput === cleanAnswer || cleanAnswer.includes(cleanInput);
      onAnswer(textInput, isCorrect);
  };

  const renderFillBlank = () => (
    <div className="mt-4">
       <form onSubmit={handleTextSubmit} className="relative">
          <input 
            type="text" 
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            disabled={isAnswered}
            placeholder="Ketik jawaban kamu..."
            autoFocus
            className={`
                w-full text-center text-xl md:text-2xl font-bold p-6 rounded-2xl border-2 outline-none transition-all
                placeholder:text-slate-300 placeholder:font-normal
                ${isAnswered 
                    ? (userAnswer.toString().toLowerCase() === question.correctAnswer?.toLowerCase() 
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-inner" 
                        : "bg-rose-50 border-rose-500 text-rose-700 shadow-inner")
                    : "bg-white/50 border-white/60 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 text-slate-700"
                }
            `}
          />
          {!isAnswered && (
             <button type="submit" className="absolute right-3 top-3 bottom-3 bg-slate-800 text-white px-6 rounded-xl font-bold hover:bg-black transition-colors shadow-lg">
                Jawab
             </button>
          )}
       </form>

       {isAnswered && (userAnswer.toString().toLowerCase() !== question.correctAnswer?.toLowerCase()) && (
          <div className="mt-4 flex items-center justify-center gap-2 p-3 bg-rose-100/50 rounded-xl border border-rose-200 text-rose-700 text-sm">
             <span className="opacity-70">Jawaban:</span>
             <span className="font-black text-lg">{question.correctAnswer}</span>
          </div>
       )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className="relative bg-white/30 backdrop-blur-2xl border border-white/50 rounded-[3rem] p-8 md:p-10 shadow-2xl shadow-indigo-900/5 overflow-hidden">
         
         {/* Background Decoration */}
         <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

         {/* TYPE BADGE */}
         <div className="flex justify-between items-start mb-6 relative z-10">
            <div className="flex gap-2">
                {question.type === 'TRUE_FALSE' && <span className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[10px] font-bold uppercase flex items-center shadow-sm"><ToggleLeft size={12} className="mr-1"/> True/False</span>}
                {question.type === 'FILL_BLANK' && <span className="px-3 py-1 bg-purple-50 text-purple-600 border border-purple-100 rounded-full text-[10px] font-bold uppercase flex items-center shadow-sm"><Type size={12} className="mr-1"/> Isian</span>}
                {question.difficulty && <span className={`px-3 py-1 border rounded-full text-[10px] font-bold uppercase shadow-sm ${question.difficulty === 'Hard' ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>{question.difficulty}</span>}
            </div>
            {question.keyPoint && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white/40 px-2 py-1 rounded border border-white/50">{question.keyPoint}</span>}
         </div>

         {/* QUESTION TEXT */}
         <h2 className="text-2xl md:text-3xl font-bold text-slate-800 text-center mt-4 mb-10 leading-relaxed drop-shadow-sm">
            {question.text}
         </h2>

         {/* DYNAMIC CONTENT */}
         <div className="mb-8 relative z-10">
            {question.type === 'TRUE_FALSE' ? renderTrueFalse() : 
             question.type === 'FILL_BLANK' ? renderFillBlank() : 
             renderMCQ()}
         </div>

         {/* EXPLANATION */}
         <AnimatePresence>
            {isAnswered && (
               <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="overflow-hidden relative z-10">
                  <div className="pt-8 border-t border-slate-200/50">
                     <div className="bg-white/60 border border-white rounded-3xl p-6 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl shrink-0 shadow-inner">
                                <Lightbulb size={24} />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-700 text-sm mb-1 uppercase tracking-wide">Pembahasan</h4>
                                <p className="text-slate-600 text-sm leading-relaxed">{question.explanation}</p>
                            </div>
                        </div>
                     </div>
                     
                     <div className="mt-6 flex flex-col items-center">
                        <button onClick={onNext} className="group relative px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg shadow-xl shadow-slate-500/20 hover:scale-105 hover:shadow-2xl transition-all duration-300 w-full md:w-auto overflow-hidden">
                            <span className="relative z-10 flex items-center justify-center">
                                Lanjut <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </button>
                        <p className="text-[10px] text-slate-400 mt-3 font-medium">
                            Tekan <span className="border border-slate-300 px-1 rounded bg-white text-slate-600">Enter</span> atau <span className="border border-slate-300 px-1 rounded bg-white text-slate-600">Spasi</span>
                        </p>
                     </div>
                  </div>
               </motion.div>
            )}
         </AnimatePresence>
      </div>
    </motion.div>
  );
};
