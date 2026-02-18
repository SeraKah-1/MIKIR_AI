
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Heart, Clock, AlertTriangle, SkipForward, X, ArrowLeft } from 'lucide-react';
import { Question, QuizResult, QuizMode } from '../types';
import { useGameSound } from '../hooks/useGameSound';
import { GestureControl } from './GestureControl';
import { getGestureEnabled, addToGraveyard } from '../services/storageService';
import { UniversalQuestionCard } from './UniversalQuestionCard'; 
import confetti from 'canvas-confetti';

interface QuizInterfaceProps {
  questions: Question[];
  mode: QuizMode;
  onComplete: (result: QuizResult) => void;
  onExit: () => void;
  onDelete?: () => void;
}

const KAO = {
  IDLE: { face: "( ◕ ‿ ◕ )", color: "bg-white border-slate-200 text-slate-600", msg: "Fokus..." },
  THINK: { face: "( . _ . )?", color: "bg-indigo-50 border-indigo-200 text-indigo-500", msg: "Hmm..." },
  CORRECT: [
    { face: "( ✧ ▽ ✧ )", color: "bg-emerald-100 border-emerald-300 text-emerald-600", msg: "Benar!" },
    { face: "٩( ◕ ᗜ ◕ )و", color: "bg-teal-100 border-teal-300 text-teal-600", msg: "Nice!" },
    { face: "( b ᵔ ▽ ᵔ )b", color: "bg-green-100 border-green-300 text-green-600", msg: "Mantap!" }
  ],
  WRONG: [
    { face: "( ≧Д≦)", color: "bg-rose-100 border-rose-300 text-rose-600", msg: "Salah!" },
    { face: "( ; ω ; )", color: "bg-red-100 border-red-300 text-red-600", msg: "Yah..." },
    { face: "( ◡ _ ◡ )", color: "bg-orange-100 border-orange-300 text-orange-600", msg: "Oops." }
  ],
  STREAK: { face: "( 🔥 ◡ 🔥 )", color: "bg-amber-100 border-amber-300 text-amber-600", msg: "ON FIRE!" },
  SHOCK: { face: "( ⊙ _ ⊙ )", color: "bg-purple-100 border-purple-300 text-purple-600", msg: "Waduh!" }
};

export const QuizInterface: React.FC<QuizInterfaceProps> = ({ questions, mode, onComplete, onExit, onDelete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState<any>(null); 
  const [isAnswered, setIsAnswered] = useState(false);
  const [answers, setAnswers] = useState<any[]>([]);
  
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(20);
  
  const [kaomojiState, setKaomojiState] = useState(KAO.IDLE);
  const [flashType, setFlashType] = useState<'none' | 'success' | 'error'>('none');
  const [isGestureEnabled, setIsGestureEnabled] = useState(false);
  
  const { playCorrect, playIncorrect, playClick } = useGameSound();

  useEffect(() => { setIsGestureEnabled(getGestureEnabled()); }, []);

  const currentQuestion = questions[currentIndex];
  // Calculate progress for worm bar (width in percentage)
  const progress = ((currentIndex + 1) / questions.length) * 100;

  useEffect(() => {
    const history = answers.find(a => a.questionId === currentQuestion.id);
    if (history) {
        setIsAnswered(true);
        setUserAnswer(history.selectedIndex !== -1 ? history.selectedIndex : history.textAnswer);
    } else {
        setIsAnswered(false);
        setUserAnswer(null);
    }
  }, [currentIndex, questions, answers, currentQuestion.id]);

  const handleAnswer = useCallback((answerInput: any, isCorrect: boolean) => {
    if (isAnswered) return;
    setUserAnswer(answerInput);
    setIsAnswered(true);

    if (isCorrect) {
      playCorrect();
      setStreak(s => s + 1);
      setFlashType('success');
      
      const nextStreak = streak + 1;
      if (nextStreak >= 3) {
         setKaomojiState(KAO.STREAK);
         confetti({ particleCount: 20, spread: 40, origin: { y: 0.8 }, colors: ['#fbbf24', '#f59e0b'] });
      } else {
         setKaomojiState(KAO.CORRECT[Math.floor(Math.random() * KAO.CORRECT.length)]);
      }
    } else {
      playIncorrect();
      setStreak(0);
      setFlashType('error');
      setKaomojiState(KAO.WRONG[Math.floor(Math.random() * KAO.WRONG.length)]);
      
      addToGraveyard(currentQuestion);
      if (mode === QuizMode.SURVIVAL) setLives(l => Math.max(0, l - 1));
    }

    setAnswers(prev => {
        const existingIdx = prev.findIndex(a => a.questionId === currentQuestion.id);
        const newEntry = { 
            questionId: currentQuestion.id, 
            selectedIndex: typeof answerInput === 'number' ? answerInput : -1,
            textAnswer: typeof answerInput === 'string' ? answerInput : undefined,
            isCorrect 
        };
        
        if (existingIdx !== -1) {
            const updated = [...prev];
            updated[existingIdx] = newEntry;
            return updated;
        }
        return [...prev, newEntry];
    });
  }, [currentQuestion, streak, mode, playCorrect, playIncorrect, isAnswered]);

  const handleNext = useCallback(() => {
    playClick();
    if (mode === QuizMode.SURVIVAL && lives === 0) {
       finishQuiz();
       return;
    }
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(p => p + 1);
      setKaomojiState(lives === 1 && mode === QuizMode.SURVIVAL ? KAO.SHOCK : KAO.IDLE);
      setFlashType('none');
    } else {
      finishQuiz();
    }
  }, [currentIndex, questions.length, lives, mode, playClick]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
        playClick();
        setCurrentIndex(p => p - 1);
        setFlashType('none');
    }
  }, [currentIndex, playClick]);

  const finishQuiz = () => {
    const correctCount = answers.filter(a => a.isCorrect).length;
    onComplete({ correctCount, totalQuestions: questions.length, score: Math.round((correctCount / questions.length) * 100), mode, answers });
  };

  useEffect(() => {
    if (mode !== QuizMode.TIME_RUSH || isAnswered) return;
    setTimeLeft(20);
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAnswer(-1, false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [currentIndex, mode, isAnswered]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
            e.preventDefault(); 
            handlePrev();
        }
        if (e.key === 'Enter') isAnswered ? handleNext() : null;
        if (!isAnswered && ['1','2','3','4'].includes(e.key) && currentQuestion.type !== 'FILL_BLANK') {
            const idx = parseInt(e.key) - 1;
            handleAnswer(idx, idx === currentQuestion.correctIndex);
        }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isAnswered, handleNext, handlePrev, handleAnswer, currentQuestion]);

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-800 flex flex-col items-center relative overflow-hidden">
        
        {/* FLASH LAYER */}
        <div 
          className={`fixed inset-0 pointer-events-none transition-opacity duration-300 z-0 ${
            flashType === 'success' ? 'bg-emerald-50' : flashType === 'error' ? 'bg-rose-50' : 'bg-transparent'
          }`}
          style={{ opacity: flashType !== 'none' ? 0.6 : 0 }}
        />

        {/* --- HEADER --- */}
        <div className="w-full max-w-4xl px-6 pt-6 pb-4 flex items-center justify-between sticky top-0 z-30 bg-[#f8f9fa]/80 backdrop-blur-md">
            <button onClick={onExit} className="p-3 bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-rose-500 rounded-2xl hover:bg-rose-50 transition-all active:scale-95">
                <X size={20} strokeWidth={2.5} />
            </button>

            {/* WORM PROGRESS BAR */}
            <div className="flex-1 mx-6 md:mx-12">
               <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden relative">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full relative"
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  >
                     {/* The "Head" of the worm */}
                     <div className="absolute right-0.5 top-0.5 bottom-0.5 w-2 bg-white/50 rounded-full" />
                  </motion.div>
               </div>
               <div className="text-center mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Soal {currentIndex + 1} dari {questions.length}
               </div>
            </div>

            {/* Stats Corner */}
            <div className="flex flex-col items-end gap-2">
                {mode === QuizMode.SURVIVAL && (
                    <div className={`flex items-center font-black px-3 py-1.5 rounded-xl text-xs border ${lives === 1 ? 'bg-rose-500 text-white border-rose-600' : 'bg-white text-rose-500 border-rose-100 shadow-sm'}`}>
                        <Heart size={14} className={`mr-1.5 ${lives === 1 ? 'fill-white' : 'fill-rose-500'}`} /> {lives}
                    </div>
                )}
                {mode === QuizMode.TIME_RUSH && (
                    <div className={`flex items-center font-mono font-bold px-3 py-1.5 rounded-xl text-xs border ${timeLeft <= 5 ? 'bg-rose-500 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-200 shadow-sm'}`}>
                        <Clock size={14} className="mr-1.5" /> {timeLeft}s
                    </div>
                )}
            </div>
        </div>

        {/* KAOMOJI FLOATING */}
        <div className="fixed left-1/2 -translate-x-1/2 top-24 z-20 pointer-events-none">
            <AnimatePresence mode='wait'>
                <motion.div 
                    key={kaomojiState.face}
                    initial={{ scale: 0.8, opacity: 0, y: -20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, y: 20 }}
                    className={`
                        flex items-center gap-3 px-6 py-3 rounded-full border-2 shadow-lg transition-colors bg-white/90 backdrop-blur
                        ${kaomojiState.color}
                    `}
                >
                    <span className="text-2xl font-black whitespace-nowrap tracking-widest">{kaomojiState.face}</span>
                    {(isAnswered || streak > 2) && (
                        <span className="text-xs font-bold uppercase border-l-2 pl-3 border-current/20 overflow-hidden whitespace-nowrap">
                            {kaomojiState.msg}
                        </span>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>

        {/* --- MAIN CARD --- */}
        <div className="flex-1 w-full flex items-center justify-center px-4 pb-12 pt-16 relative z-10">
            {currentIndex > 0 && (
                <button 
                    onClick={handlePrev}
                    className="hidden lg:flex absolute left-8 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 shadow-lg hover:shadow-xl border border-slate-100 transition-all active:scale-95"
                    title="Kembali"
                >
                    <ArrowLeft size={24} />
                </button>
            )}

            <AnimatePresence mode='wait'>
                <UniversalQuestionCard 
                    key={`${currentQuestion.id}-${currentIndex}`} 
                    question={currentQuestion}
                    isAnswered={isAnswered}
                    userAnswer={userAnswer}
                    onAnswer={handleAnswer}
                    onNext={handleNext}
                />
            </AnimatePresence>
        </div>

        {isGestureEnabled && (
            <GestureControl 
                onOptionSelect={(idx) => handleAnswer(idx, idx === currentQuestion.correctIndex)}
                onNext={handleNext}
                onPrev={handlePrev}
                isAnswered={isAnswered}
            />
        )}
    </div>
  );
};
