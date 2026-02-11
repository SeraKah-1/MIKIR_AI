
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCw, ArrowLeft, ArrowRight, X, Clock, ThumbsUp, AlertCircle, Keyboard, BrainCircuit } from 'lucide-react';
import { Question } from '../types';
import { processCardReview, getNextReviewText, addQuestionToSRS } from '../services/srsService';

interface FlashcardScreenProps {
  questions: Question[];
  onClose: () => void;
}

export const FlashcardScreen: React.FC<FlashcardScreenProps> = ({ questions, onClose }) => {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Initialize SRS for these cards if not present
  useEffect(() => {
    questions.forEach(q => addQuestionToSRS(q));
  }, [questions]);

  // SRS Logic
  const handleReview = useCallback((difficulty: 'hard' | 'good' | 'easy') => {
    if(isAnimating) return;
    
    const currentQ = questions[index];
    
    // Map difficulty to Quality (SM-2)
    // Hard = 3, Good = 4, Easy = 5
    let quality = 3;
    if (difficulty === 'good') quality = 4;
    if (difficulty === 'easy') quality = 5;

    const result = processCardReview(currentQ, quality);
    console.log(`Reviewed. Next due in ${result.interval} days.`);
    
    // Flip back first, then change
    setIsFlipped(false);
    setIsAnimating(true);
    setTimeout(() => {
      if (index < questions.length - 1) {
          setIndex((prev) => prev + 1);
      } else {
          // End of deck
          alert("Sesi Review Selesai! Kartu telah dijadwalkan ulang.");
          onClose();
      }
      setIsAnimating(false);
    }, 300); // Wait for flip animation
  }, [index, questions, isAnimating, onClose]);

  const handleFlip = useCallback(() => {
    if(!isAnimating) setIsFlipped(prev => !prev);
  }, [isAnimating]);

  const handleNext = useCallback(() => {
     if(isAnimating) return;
     if (index >= questions.length - 1) return;

     if(isFlipped) {
       setIsFlipped(false);
       setIsAnimating(true);
       setTimeout(() => {
          setIndex((prev) => prev + 1);
          setIsAnimating(false);
       }, 300);
     } else {
       setIndex((prev) => prev + 1);
     }
  }, [questions.length, isFlipped, isAnimating, index]);

  const handlePrev = useCallback(() => {
     if(isAnimating) return;
     if (index <= 0) return;

     if(isFlipped) {
       setIsFlipped(false);
       setIsAnimating(true);
       setTimeout(() => {
          setIndex((prev) => prev - 1);
          setIsAnimating(false);
       }, 300);
     } else {
       setIndex((prev) => prev - 1);
     }
  }, [questions.length, isFlipped, isAnimating, index]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' || e.key === 'Enter') {
         e.preventDefault();
         handleFlip();
      }
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();

      // Only work if flipped (showing answer)
      if (isFlipped) {
        if (e.key === '1') handleReview('hard');
        if (e.key === '2') handleReview('good');
        if (e.key === '3') handleReview('easy');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, handleReview, handleFlip, handleNext, handlePrev, onClose]);

  const currentQ = questions[index];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-md">
      <div className="w-full max-w-2xl relative">
        <button 
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:text-indigo-200 transition-colors bg-white/10 p-2 rounded-full backdrop-blur-md"
        >
          <X size={24} />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white tracking-wide flex items-center justify-center">
            <BrainCircuit className="mr-2 text-indigo-400" /> Review Mode
          </h2>
          <p className="text-white/70 flex items-center justify-center gap-2">
            Card {index + 1} of {questions.length}
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded text-white/50 flex items-center">
               <Keyboard size={10} className="mr-1" /> Space to Flip
            </span>
          </p>
        </div>

        {/* Card Container with Perspective */}
        <div className="relative h-[450px] w-full perspective-1000 cursor-pointer group" onClick={handleFlip}>
          <motion.div
            className="w-full h-full relative preserve-3d"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* FRONT (Question) */}
            <div 
              className="absolute inset-0 backface-hidden bg-white rounded-[2rem] p-8 flex flex-col items-center justify-center text-center shadow-2xl border border-indigo-100"
              style={{ backfaceVisibility: "hidden" }}
            >
              <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full mb-6">QUESTION</span>
              <h3 className="text-xl md:text-2xl font-medium text-slate-800 leading-snug">
                {currentQ.text}
              </h3>
              <p className="mt-8 text-slate-400 text-sm flex items-center animate-pulse">
                <RotateCw size={14} className="mr-2" /> Tap to reveal answer
              </p>
            </div>

            {/* BACK (Answer) */}
            <div 
              className="absolute inset-0 backface-hidden bg-slate-900 rounded-[2rem] p-8 flex flex-col items-center justify-between text-center shadow-2xl border border-slate-700 text-white"
              style={{ 
                backfaceVisibility: "hidden", 
                transform: "rotateY(180deg)" 
              }}
            >
              <div className="w-full flex-1 flex flex-col justify-center">
                <span className="text-xs font-bold text-emerald-300 bg-emerald-900/50 px-3 py-1 rounded-full mb-4 inline-block mx-auto">ANSWER</span>
                <h3 className="text-2xl font-bold mb-4 text-emerald-400">
                  {currentQ.options[currentQ.correctIndex]}
                </h3>
                <div className="w-20 h-px bg-slate-700 mx-auto mb-4" />
                <p className="text-slate-300 text-sm leading-relaxed overflow-y-auto max-h-[120px] custom-scrollbar px-2">
                  {currentQ.explanation}
                </p>
              </div>

              {/* SRS Controls */}
              <div className="grid grid-cols-3 gap-3 w-full mt-4 border-t border-slate-800 pt-4" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => handleReview('hard')} className="flex flex-col items-center p-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all group active:scale-95">
                   <div className="flex items-center space-x-1 mb-1">
                      <AlertCircle size={14} className="text-rose-400" />
                      <span className="text-xs font-bold text-rose-200">Hard</span>
                   </div>
                   <span className="text-[10px] text-rose-400 opacity-70">~1 Day</span>
                </button>
                
                <button onClick={() => handleReview('good')} className="flex flex-col items-center p-3 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-all group active:scale-95">
                   <div className="flex items-center space-x-1 mb-1">
                      <Clock size={14} className="text-blue-400" />
                      <span className="text-xs font-bold text-blue-200">Good</span>
                   </div>
                   <span className="text-[10px] text-blue-400 opacity-70">~3 Days</span>
                </button>
                
                <button onClick={() => handleReview('easy')} className="flex flex-col items-center p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all group active:scale-95">
                   <div className="flex items-center space-x-1 mb-1">
                      <ThumbsUp size={14} className="text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-200">Easy</span>
                   </div>
                   <span className="text-[10px] text-emerald-400 opacity-70">~7 Days</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
        
        <div className="text-center mt-6 text-white/30 text-xs">
           Spaced Repetition System Active
        </div>
      </div>
    </div>
  );
};
