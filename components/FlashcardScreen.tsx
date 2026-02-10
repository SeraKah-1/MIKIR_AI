import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCw, ArrowLeft, ArrowRight, X, Clock, ThumbsUp, AlertCircle, Keyboard } from 'lucide-react';
import { Question } from '../types';
import { GlassButton } from './GlassButton';

interface FlashcardScreenProps {
  questions: Question[];
  onClose: () => void;
}

export const FlashcardScreen: React.FC<FlashcardScreenProps> = ({ questions, onClose }) => {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // SRS Logic (Simulated)
  const handleReview = useCallback((difficulty: 'hard' | 'good' | 'easy') => {
    // In a real app, save nextReviewDate to DB
    const nextReviewDays = difficulty === 'hard' ? 1 : difficulty === 'good' ? 3 : 7;
    console.log(`Scheduled card ${questions[index].id} for ${nextReviewDays} days.`);
    
    setIsFlipped(false);
    setTimeout(() => {
      setIndex((prev) => (prev + 1) % questions.length);
    }, 200);
  }, [index, questions]);

  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  const handleNext = useCallback(() => {
     setIsFlipped(false);
     setTimeout(() => setIndex((prev) => (prev + 1) % questions.length), 150);
  }, [questions.length]);

  const handlePrev = useCallback(() => {
     setIsFlipped(false);
     setTimeout(() => setIndex((prev) => (prev - 1 + questions.length) % questions.length), 150);
  }, [questions.length]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
      <div className="w-full max-w-2xl relative">
        <button 
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:text-indigo-200 transition-colors bg-white/10 p-2 rounded-full backdrop-blur-md"
        >
          <X size={24} />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white tracking-wide">Flashcard Review</h2>
          <p className="text-white/70 flex items-center justify-center gap-2">
            Card {index + 1} of {questions.length}
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded text-white/50 flex items-center">
               <Keyboard size={10} className="mr-1" /> Space to Flip
            </span>
          </p>
        </div>

        {/* Card Container with Perspective */}
        <div className="relative h-[400px] w-full perspective-1000 cursor-pointer group" onClick={handleFlip}>
          <motion.div
            className="w-full h-full relative preserve-3d transition-all duration-500"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* FRONT (Question) */}
            <div 
              className="absolute inset-0 backface-hidden bg-white rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl border border-indigo-100"
              style={{ backfaceVisibility: "hidden" }}
            >
              <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full mb-4">QUESTION</span>
              <h3 className="text-xl md:text-2xl font-medium text-slate-800 leading-snug">
                {currentQ.text}
              </h3>
              <p className="mt-8 text-slate-400 text-sm flex items-center">
                <RotateCw size={14} className="mr-2" /> Tap or Space to reveal
              </p>
            </div>

            {/* BACK (Answer) */}
            <div 
              className="absolute inset-0 backface-hidden bg-indigo-600 rounded-3xl p-8 flex flex-col items-center justify-between text-center shadow-2xl border border-indigo-400 text-white"
              style={{ 
                backfaceVisibility: "hidden", 
                transform: "rotateY(180deg)" 
              }}
            >
              <div className="w-full">
                <span className="text-xs font-bold text-indigo-200 bg-indigo-800 px-3 py-1 rounded-full mb-4 inline-block">ANSWER</span>
                <h3 className="text-2xl font-bold mb-4">
                  {currentQ.options[currentQ.correctIndex]}
                </h3>
                <div className="w-full h-px bg-indigo-400/50 mb-4" />
                <p className="text-indigo-100 text-sm leading-relaxed line-clamp-4">
                  {currentQ.explanation}
                </p>
              </div>

              {/* SRS Controls */}
              <div className="grid grid-cols-3 gap-3 w-full mt-4" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => handleReview('hard')} className="flex flex-col items-center p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 border border-rose-400/30 transition-all relative group">
                   <div className="absolute top-1 right-2 text-[8px] opacity-50 border border-white/30 px-1 rounded hidden group-hover:block">Key: 1</div>
                   <AlertCircle size={16} className="mb-1 text-rose-200" />
                   <span className="text-[10px] font-bold">Hard</span>
                   <span className="text-[9px] opacity-70">1d</span>
                </button>
                <button onClick={() => handleReview('good')} className="flex flex-col items-center p-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/40 border border-blue-400/30 transition-all relative group">
                   <div className="absolute top-1 right-2 text-[8px] opacity-50 border border-white/30 px-1 rounded hidden group-hover:block">Key: 2</div>
                   <Clock size={16} className="mb-1 text-blue-200" />
                   <span className="text-[10px] font-bold">Good</span>
                   <span className="text-[9px] opacity-70">3d</span>
                </button>
                <button onClick={() => handleReview('easy')} className="flex flex-col items-center p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/40 border border-emerald-400/30 transition-all relative group">
                   <div className="absolute top-1 right-2 text-[8px] opacity-50 border border-white/30 px-1 rounded hidden group-hover:block">Key: 3</div>
                   <ThumbsUp size={16} className="mb-1 text-emerald-200" />
                   <span className="text-[10px] font-bold">Easy</span>
                   <span className="text-[9px] opacity-70">7d</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
        
        {/* Navigation Hints */}
        <div className="flex justify-between mt-4 px-2">
            <button onClick={handlePrev} className="text-white/30 hover:text-white text-xs flex items-center transition-colors"><ArrowLeft size={12} className="mr-1"/> Prev</button>
            <button onClick={handleNext} className="text-white/30 hover:text-white text-xs flex items-center transition-colors">Next <ArrowRight size={12} className="ml-1"/></button>
        </div>
      </div>
    </div>
  );
};