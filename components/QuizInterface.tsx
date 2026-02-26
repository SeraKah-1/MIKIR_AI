
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Heart, Clock, AlertTriangle, SkipForward, X, ArrowLeft, ChevronLeft, Hand, Eye, Settings, Power } from 'lucide-react';
import { Question, QuizResult, QuizMode } from '../types';
import { useGameSound } from '../hooks/useGameSound';
import { GestureControl } from './GestureControl';
import { addToGraveyard } from '../services/storageService';
import { UniversalQuestionCard } from './UniversalQuestionCard'; 
import { EyeTrackingManager } from './EyeTrackingManager';
import confetti from 'canvas-confetti';
import { useExperimentalSettings } from '../contexts/ExperimentalSettingsContext';
import { useCamera } from '../contexts/CameraContext';

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
  
  const { playCorrect, playIncorrect, playClick } = useGameSound();

  // --- NEW CONTEXT HOOKS ---
  const { isExperimentalEnabled, toggleExperimental } = useExperimentalSettings();
  const { mode: cameraMode, setMode: setCameraMode } = useCamera();
  const [showSettings, setShowSettings] = useState(false);

  // Sync camera mode with experimental settings
  useEffect(() => {
    if (!isExperimentalEnabled && cameraMode !== 'OFF') {
      setCameraMode('OFF');
    }
  }, [isExperimentalEnabled, cameraMode, setCameraMode]);

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
        // Prevent shortcuts if typing in input (e.g., Fill in Blank)
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        if (e.code === 'ArrowLeft' || e.code === 'Space') {
            if (e.code === 'Space') e.preventDefault(); // Prevent scrolling
            handlePrev();
        }
        if (e.code === 'ArrowRight' && isAnswered) {
            handleNext();
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
            {/* LEFT: Exit & Prev */}
            <div className="flex items-center gap-2">
                <button onClick={onExit} className="p-3 bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-rose-500 rounded-2xl hover:bg-rose-50 transition-all active:scale-95">
                    <X size={20} strokeWidth={2.5} />
                </button>
                {/* PREVIOUS BUTTON MOVED HERE */}
                {currentIndex > 0 && (
                    <button 
                        onClick={handlePrev}
                        title="Previous (Space / Arrow Left)"
                        className="p-3 bg-white border border-slate-200 shadow-sm text-slate-400 hover:text-indigo-600 rounded-2xl hover:bg-indigo-50 transition-all active:scale-95"
                    >
                        <ChevronLeft size={20} strokeWidth={2.5} />
                    </button>
                )}
            </div>

            {/* WORM PROGRESS BAR */}
            <div className="flex-1 mx-4 md:mx-8">
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

            {/* RIGHT: Stats & Tools */}
            <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                    {/* SETTINGS TOGGLE */}
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-xl border shadow-sm transition-all active:scale-95 ${showSettings ? 'bg-slate-800 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600'}`}
                    >
                        <Settings size={16} strokeWidth={2.5} />
                    </button>

                    {/* EXPERIMENTAL CONTROLS (Only if enabled) */}
                    {isExperimentalEnabled && (
                        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                            <button 
                                onClick={() => setCameraMode(cameraMode === 'EYE' ? 'OFF' : 'EYE')}
                                className={`p-2 rounded-lg transition-all flex items-center gap-2 ${cameraMode === 'EYE' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
                                title="Eye Tracking (Nose Navigation)"
                            >
                                <Eye size={16} strokeWidth={2.5} />
                                {cameraMode === 'EYE' && <span className="text-xs font-bold pr-1">Mata</span>}
                            </button>
                            <button 
                                onClick={() => setCameraMode(cameraMode === 'HAND' ? 'OFF' : 'HAND')}
                                className={`p-2 rounded-lg transition-all flex items-center gap-2 ${cameraMode === 'HAND' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
                                title="Hand Gesture Control"
                            >
                                <Hand size={16} strokeWidth={2.5} />
                                {cameraMode === 'HAND' && <span className="text-xs font-bold pr-1">Tangan</span>}
                            </button>
                        </div>
                    )}
                </div>

                {/* SETTINGS POPUP */}
                <AnimatePresence>
                    {showSettings && (
                        <motion.div 
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50"
                        >
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Experimental Features</h3>
                            
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-lg ${isExperimentalEnabled ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <Power size={14} strokeWidth={3} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700">Camera Input</span>
                                </div>
                                <button 
                                    onClick={toggleExperimental}
                                    className={`w-10 h-6 rounded-full transition-colors relative ${isExperimentalEnabled ? 'bg-indigo-500' : 'bg-slate-200'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isExperimentalEnabled ? 'left-5' : 'left-1'}`} />
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-tight">
                                Enable experimental camera-based inputs (Eye Tracking & Hand Gestures). May consume more battery.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

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

        {/* KAOMOJI: ABSOLUTE POSITIONING */}
        <div className="absolute left-1/2 -translate-x-1/2 top-20 z-0 pointer-events-none">
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

        {isExperimentalEnabled && cameraMode === 'HAND' && (
            <GestureControl 
                onOptionSelect={(idx) => handleAnswer(idx, idx === currentQuestion.correctIndex)}
                onNext={handleNext}
                onPrev={handlePrev}
                isAnswered={isAnswered}
            />
        )}

        {isExperimentalEnabled && cameraMode === 'EYE' && (
            <EyeTrackingManager 
                onOptionSelect={(idx) => handleAnswer(idx, idx === currentQuestion.correctIndex)}
                onNext={handleNext}
                onPrev={handlePrev}
                isAnswered={isAnswered}
            />
        )}
    </div>
  );
};
