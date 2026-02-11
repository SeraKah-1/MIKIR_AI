
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { RotateCw, X, ThumbsUp, AlertCircle, Keyboard, BrainCircuit, Hand } from 'lucide-react';
import { Question } from '../types';
import { processCardReview, addQuestionToSRS } from '../services/srsService';
import { useGameSound } from '../hooks/useGameSound';

interface FlashcardScreenProps {
  questions: Question[];
  onClose: () => void;
}

export const FlashcardScreen: React.FC<FlashcardScreenProps> = ({ questions, onClose }) => {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [exitX, setExitX] = useState<number | null>(null); // To track swipe exit direction
  
  const { playClick, playSwipe, triggerHaptic } = useGameSound();

  // Framer Motion Values for Swipe Logic
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]); // Rotate card while dragging
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]); 
  
  // Background color hints based on drag position
  const bgOverlayOpacity = useTransform(x, [-150, 0, 150], [0.4, 0, 0.4]);
  const bgOverlayColor = useTransform(x, [-150, 0, 150], [
    "rgba(244, 63, 94, 1)", // Red (Hard) on Left
    "rgba(255, 255, 255, 0)", 
    "rgba(16, 185, 129, 1)" // Green (Easy) on Right
  ]);

  // Initialize SRS
  useEffect(() => {
    questions.forEach(q => addQuestionToSRS(q));
  }, [questions]);

  // Handle Swipe End
  const handleDragEnd = (event: any, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      handleReview('easy'); // Swipe Right
    } else if (info.offset.x < -threshold) {
      handleReview('hard'); // Swipe Left
    } else {
      // Reset position if not swiped far enough
      triggerHaptic(5); 
    }
  };

  const handleReview = useCallback((difficulty: 'hard' | 'good' | 'easy') => {
    if (exitX !== null) return; // Prevent double trigger
    
    playSwipe();
    
    // Set exit animation direction
    if (difficulty === 'easy') setExitX(200);
    else if (difficulty === 'hard') setExitX(-200);
    else setExitX(0); // Good stays or handled differently? Let's treat 'good' as swipe up (optional) or button click
    
    const currentQ = questions[index];
    
    let quality = 3;
    if (difficulty === 'good') quality = 4;
    if (difficulty === 'easy') quality = 5;

    processCardReview(currentQ, quality);
    
    // Animate out, then load next
    setTimeout(() => {
      if (index < questions.length - 1) {
          setIndex((prev) => prev + 1);
          setIsFlipped(false);
          x.set(0); // Reset motion value
          setExitX(null);
      } else {
          alert("Sesi Review Selesai! Kartu telah dijadwalkan ulang.");
          onClose();
      }
    }, 200); 
  }, [index, questions, onClose, playSwipe, exitX, x]);

  const handleFlip = useCallback(() => {
    if (exitX === null) {
      triggerHaptic(10);
      setIsFlipped(prev => !prev);
    }
  }, [exitX, triggerHaptic]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp') {
         e.preventDefault();
         handleFlip();
      }
      if (e.key === 'ArrowRight') handleReview('easy');
      if (e.key === 'ArrowLeft') handleReview('hard');
      if (e.key === 'ArrowDown') handleReview('good');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, handleReview, handleFlip, onClose]);

  const currentQ = questions[index];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-md overflow-hidden">
      <div className="w-full max-w-xl relative flex flex-col h-full max-h-[700px]">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-4 pt-4">
           <div className="flex flex-col">
              <h2 className="text-xl font-bold text-white flex items-center">
                <BrainCircuit className="mr-2 text-indigo-400" /> Review
              </h2>
              <p className="text-white/50 text-xs">{index + 1} / {questions.length}</p>
           </div>
           <button 
             onClick={onClose}
             className="text-white/70 hover:text-white bg-white/10 p-2 rounded-full"
           >
             <X size={20} />
           </button>
        </div>

        {/* SWIPE AREA */}
        <div className="flex-1 relative perspective-1000 flex items-center justify-center">
          
          {/* Card Stack Effect (Dummy Card Behind) */}
          {index < questions.length - 1 && (
            <div className="absolute inset-4 top-6 bg-white/5 rounded-[2rem] border border-white/5 scale-95 opacity-50 z-0" />
          )}

          <motion.div
            className="w-full h-full max-h-[500px] relative cursor-grab active:cursor-grabbing z-10"
            style={{ x, rotate, opacity }}
            drag={true}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }} // Constraints set to 0 to snap back, but dragElastic allows movement
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            animate={exitX !== null ? { x: exitX * 5, opacity: 0 } : { x: 0, opacity: 1 }}
          >
             {/* Dynamic Overlay Color for Feedback */}
             <motion.div 
               className="absolute inset-0 rounded-[2rem] z-20 pointer-events-none border-4"
               style={{ backgroundColor: bgOverlayColor, opacity: bgOverlayOpacity, borderColor: bgOverlayColor }} 
             />

             {/* CARD CONTENT */}
             <motion.div
                className="w-full h-full relative preserve-3d transition-all duration-300"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                style={{ transformStyle: "preserve-3d" }}
                onClick={handleFlip}
             >
                {/* FRONT */}
                <div 
                  className="absolute inset-0 backface-hidden bg-white rounded-[2rem] p-8 flex flex-col items-center justify-center text-center shadow-2xl border border-indigo-100 select-none"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full mb-6">PERTANYAAN</span>
                  <h3 className="text-xl md:text-2xl font-medium text-slate-800 leading-snug">
                    {currentQ.text}
                  </h3>
                  <div className="mt-auto pt-8 text-slate-400 text-xs flex items-center animate-pulse">
                    <Hand size={14} className="mr-2" /> Tap to Flip
                  </div>
                </div>

                {/* BACK */}
                <div 
                  className="absolute inset-0 backface-hidden bg-slate-800 rounded-[2rem] p-8 flex flex-col items-center text-center shadow-2xl border border-slate-700 text-white select-none"
                  style={{ 
                    backfaceVisibility: "hidden", 
                    transform: "rotateY(180deg)" 
                  }}
                >
                  <span className="text-xs font-bold text-emerald-300 bg-emerald-900/50 px-3 py-1 rounded-full mb-4">JAWABAN</span>
                  <h3 className="text-xl font-bold mb-4 text-emerald-400">
                    {currentQ.options[currentQ.correctIndex]}
                  </h3>
                  <div className="w-16 h-px bg-slate-600 mb-4" />
                  <p className="text-slate-300 text-sm leading-relaxed overflow-y-auto custom-scrollbar flex-1">
                    {currentQ.explanation}
                  </p>
                </div>
             </motion.div>
          </motion.div>

          {/* SWIPE INDICATORS (Visual Hints) */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500/50 pointer-events-none hidden md:block">
             <AlertCircle size={48} />
             <p className="font-bold text-xs uppercase -ml-2 mt-2">Lupa / Hard</p>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500/50 pointer-events-none hidden md:block">
             <ThumbsUp size={48} />
             <p className="font-bold text-xs uppercase -ml-1 mt-2">Ingat / Easy</p>
          </div>
        </div>

        {/* CONTROLS (Buttons for fallback/desktop) */}
        <div className="mt-6 grid grid-cols-3 gap-4">
           <button onClick={() => handleReview('hard')} className="flex flex-col items-center p-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition-colors active:scale-95">
              <AlertCircle size={20} className="mb-1" />
              <span className="text-xs font-bold">Hard</span>
           </button>
           <button onClick={() => handleReview('good')} className="flex flex-col items-center p-3 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 transition-colors active:scale-95">
              <RotateCw size={20} className="mb-1" />
              <span className="text-xs font-bold">Good</span>
           </button>
           <button onClick={() => handleReview('easy')} className="flex flex-col items-center p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-colors active:scale-95">
              <ThumbsUp size={20} className="mb-1" />
              <span className="text-xs font-bold">Easy</span>
           </button>
        </div>
        
        <div className="text-center mt-4 text-white/30 text-[10px] flex items-center justify-center gap-4">
           <span className="flex items-center"><Keyboard size={10} className="mr-1"/> Keys: ← Hard | ↓ Good | → Easy</span>
        </div>

      </div>
    </div>
  );
};
