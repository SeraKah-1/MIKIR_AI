
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, ArrowLeft, Clock, Heart, Flame, Sparkles, Lightbulb, Volume2, LogOut, Trash2, Hand } from 'lucide-react';
import { Question, QuizResult, QuizMode } from '../types';
import { GlassButton } from './GlassButton';
import { useGameSound } from '../hooks/useGameSound';
import { GestureControl } from './GestureControl'; // NEW COMPONENT
import { getGestureEnabled } from '../services/storageService'; // NEW SETTING
import confetti from 'canvas-confetti';

// --- Utility: Enhanced Formatted Text Renderer (NON-RECURSIVE / SAFE MODE) ---
const FormattedText: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => {
  if (!text) return null;
  const safeText = String(text);

  // 1. Split by Code Blocks first (```...```)
  const blockParts = safeText.split(/(```[\s\S]*?```)/g);

  return (
    <span className={`block ${className}`}>
      {blockParts.map((part, i) => {
        // A. Handle Code Blocks
        if (part.startsWith('```') && part.endsWith('```')) {
          const content = part.slice(3, -3).trim();
          return (
            <div key={i} className="bg-slate-900 text-emerald-400 font-mono text-sm p-4 rounded-xl overflow-x-auto shadow-inner border border-slate-700 my-2 text-left">
              <div className="flex items-center text-slate-500 mb-2 text-xs border-b border-slate-700 pb-1">
                 <div className="mr-1">⚡</div> Code Snippet
              </div>
              <pre className="whitespace-pre-wrap break-words leading-relaxed">{content}</pre>
            </div>
          );
        }

        // B. Handle Inline Text (Bold & Code)
        const inlineParts = part.split(/(\*\*.*?\*\*|`[^`]+`)/g);

        return (
          <span key={i}>
            {inlineParts.map((frag, j) => {
               if (frag.startsWith('**') && frag.endsWith('**') && frag.length > 4) {
                  return <strong key={j} className="font-bold text-theme-primary/80">{frag.slice(2, -2)}</strong>;
               }
               if (frag.startsWith('`') && frag.endsWith('`') && frag.length > 2) {
                  return <code key={j} className="font-mono text-sm bg-theme-glass text-theme-primary px-1.5 py-0.5 rounded border border-theme-border">{frag.slice(1, -1)}</code>;
               }
               return <span key={j}>{frag}</span>;
            })}
          </span>
        );
      })}
    </span>
  );
};

// --- Sub-component: QuestionCard ---
interface QuestionCardProps {
  question: Question;
  selectedOption: number | null;
  isAnswered: boolean;
  onOptionSelect: (index: number) => void;
  onNext: () => void;
  mode: QuizMode;
  lives: number;
  isLastQuestion: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  selectedOption,
  isAnswered,
  onOptionSelect,
  onNext,
  mode,
  lives,
  isLastQuestion
}) => {
  const { playHover, playClick } = useGameSound();
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (synth) {
      synth.cancel();
    }
    setSpeaking(false);
    
    return () => {
      if (synth) synth.cancel();
    };
  }, [question?.id]);

  const speakQuestion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!('speechSynthesis' in window)) return;

    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }

    playClick();
    setSpeaking(true);

    const textToSpeak = `${question.text}. Pilihan jawaban: ${question.options.join(', ')}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'id-ID'; 
    utterance.rate = 1.0;
    
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    synth.speak(utterance);
  };

  if (!question || !question.options) return (
     <div className="bg-theme-glass backdrop-blur-xl p-8 rounded-[2rem] text-center text-theme-muted border border-theme-border">
        <p>Memuat Kartu Soal...</p>
        <p className="text-xs opacity-50 mt-1">Data sedang disiapkan...</p>
     </div>
  );

  const cardVariants = {
    hidden: { opacity: 0, x: 50, scale: 0.95 },
    visible: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -50, scale: 0.95 },
  };

  const optionVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05 } }),
  };

  const safeOptions = Array.isArray(question.options) ? question.options : ["Error: Invalid Options Data"];
  const shortcuts = ['1', '2', '3', '4'];

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="relative w-full"
    >
      <div className="bg-theme-glass backdrop-blur-2xl border border-theme-border rounded-[2rem] p-6 md:p-10 shadow-xl shadow-indigo-500/5 relative">
        
        <div className="flex justify-center mb-6">
           <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-theme-primary/10 border border-theme-primary/20 text-theme-primary text-xs font-bold uppercase tracking-wider shadow-sm">
             <Sparkles size={12} className="mr-2" />
             {question.keyPoint || "Konsep Kunci"}
           </span>
        </div>

        <button 
          onClick={speakQuestion}
          className={`
            absolute top-6 right-6 p-2 rounded-full transition-all duration-200
            ${speaking ? 'bg-theme-primary/10 text-theme-primary animate-pulse' : 'bg-theme-bg/50 text-theme-muted hover:bg-theme-bg hover:text-theme-primary'}
          `}
          title="Bacakan Soal"
        >
          {speaking ? <Volume2 size={20} /> : <Volume2 size={20} className="opacity-50" />}
        </button>

        <h2 className="text-xl md:text-2xl font-medium text-theme-text text-center mb-8 leading-snug tracking-tight px-2 md:px-8">
          <FormattedText text={question.text} />
        </h2>

        <div className="grid grid-cols-1 gap-3">
          {safeOptions.map((option, idx) => {
            let styles = "bg-theme-bg/40 border-theme-border text-theme-text hover:bg-theme-bg hover:border-theme-primary/50";
            
            if (isAnswered) {
               if (idx === question.correctIndex) {
                 styles = "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-500/20";
               } else if (idx === selectedOption) {
                 styles = "bg-rose-100 border-rose-200 text-rose-500 opacity-80";
               } else {
                 styles = "bg-theme-bg/20 border-transparent text-theme-muted opacity-50";
               }
            }

            return (
              <motion.button
                key={idx}
                custom={idx}
                variants={optionVariants}
                initial="hidden"
                animate="visible"
                onClick={() => onOptionSelect(idx)}
                onMouseEnter={!isAnswered ? playHover : undefined}
                disabled={isAnswered}
                className={`
                  relative w-full p-4 md:p-5 rounded-2xl border-2 text-base md:text-lg font-medium transition-all duration-200
                  flex items-center text-left group
                  ${styles}
                `}
              >
                <span className={`
                  hidden md:flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold mr-4 border transition-colors
                  ${isAnswered 
                    ? 'border-transparent bg-white/20 text-current' 
                    : 'border-theme-border text-theme-muted bg-theme-bg group-hover:border-theme-primary group-hover:text-theme-primary'}
                `}>
                  {shortcuts[idx]}
                </span>

                <span className="flex-1 text-center md:text-left">
                  <FormattedText text={typeof option === 'object' ? JSON.stringify(option) : option} />
                </span>

                {isAnswered && idx === question.correctIndex && (
                  <Check className="absolute right-4 text-white" size={20} />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {isAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-4"
          >
            <div className={`
              rounded-3xl p-6 border-2 
              ${selectedOption === question.correctIndex 
                ? 'bg-emerald-50/80 border-emerald-100' 
                : 'bg-theme-glass border-theme-border'}
            `}>
              <div className="flex items-start gap-4">
                 <div className={`p-3 rounded-2xl shrink-0 ${selectedOption === question.correctIndex ? 'bg-emerald-100 text-emerald-600' : 'bg-theme-primary/10 text-theme-primary'}`}>
                   <Lightbulb size={24} />
                 </div>
                 <div className="flex-1">
                   <h3 className="font-bold text-theme-text text-lg mb-1">
                     {selectedOption === question.correctIndex ? "Tepat Sekali!" : "Pembahasan"}
                   </h3>
                   <div className="text-theme-text/80 text-sm leading-relaxed whitespace-pre-line">
                     <FormattedText text={question.explanation} />
                   </div>
                 </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <GlassButton onClick={onNext} className={`
                  pl-8 pr-6 shadow-xl 
                  ${selectedOption === question.correctIndex ? 'bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-600' : ''}
                `}>
                  {mode === QuizMode.SURVIVAL && lives === 0 ? "Lihat Hasil" : isLastQuestion ? "Selesai" : "Lanjut"} 
                  <ArrowRight size={20} className="ml-2" />
                </GlassButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- REACTIVE MASCOT COMPONENT ---
const QuizMascot: React.FC<{ state: 'idle' | 'happy' | 'sad' | 'streak', streak: number }> = ({ state, streak }) => {
  let kaomoji = "( •_•)";
  let color = "text-theme-muted";
  let bg = "bg-theme-bg/80";

  switch (state) {
    case 'happy':
      kaomoji = "( ^ ▽ ^ )";
      color = "text-emerald-500";
      bg = "bg-emerald-100/90";
      break;
    case 'sad':
      kaomoji = "( > _ < )";
      color = "text-rose-500";
      bg = "bg-rose-100/90";
      break;
    case 'streak':
      kaomoji = "( ⌐■_■ )";
      color = "text-theme-primary";
      bg = "bg-theme-primary/10";
      break;
    default:
      kaomoji = "( •_•)";
      color = "text-theme-muted";
      bg = "bg-theme-glass";
  }

  return (
     <motion.div 
        key={state}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`fixed top-24 right-4 md:right-8 z-30 px-3 py-1.5 rounded-full backdrop-blur-md border border-white/50 shadow-sm flex items-center space-x-2 ${bg}`}
     >
        <span className={`font-black text-sm whitespace-nowrap ${color}`}>{kaomoji}</span>
        {streak > 2 && state !== 'sad' && <span className="text-[10px] font-bold text-theme-muted opacity-60">x{streak}</span>}
     </motion.div>
  );
}

// --- Main Container ---

interface QuizInterfaceProps {
  questions: Question[];
  mode: QuizMode;
  onComplete: (result: QuizResult) => void;
  onExit: () => void;
  onDelete?: () => void;
}

export const QuizInterface: React.FC<QuizInterfaceProps> = ({ questions, mode, onComplete, onExit, onDelete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [answers, setAnswers] = useState<{ questionId: number; selectedIndex: number; isCorrect: boolean }[]>([]);
  
  const { playCorrect, playIncorrect, playClick } = useGameSound();

  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(20);
  const [mascotState, setMascotState] = useState<'idle' | 'happy' | 'sad' | 'streak'>('idle');

  const [isGestureEnabled, setIsGestureEnabled] = useState(false);

  useEffect(() => {
    setIsGestureEnabled(getGestureEnabled());
  }, []);

  // SAFETY CHECK
  if (!questions || questions.length === 0) {
      return (
          <div className="p-10 text-center">
             <h2 className="text-xl font-bold text-theme-text mb-2">Error</h2>
             <p className="text-theme-muted mb-4">Data soal tidak ditemukan.</p>
             <button onClick={onExit} className="px-4 py-2 bg-theme-primary text-white rounded-xl">Kembali</button>
          </div>
      );
  }

  const currentQuestion = (currentIndex < questions.length) ? questions[currentIndex] : null;

  // --- LOGIC HANDLERS ---
  const handleAnswer = useCallback((index: number, isCorrect: boolean) => {
    if (!currentQuestion) return;
    
    setSelectedOption(index);
    setIsAnswered(true);

    if (isCorrect) {
      playCorrect();
      const newStreak = streak + 1;
      setStreak(newStreak);
      
      if (newStreak >= 3) {
         setMascotState('streak');
         if (newStreak % 3 === 0) {
            confetti({
              particleCount: 30,
              spread: 60,
              origin: { y: 0.7 },
              colors: ['#6366f1', '#10b981', '#f43f5e']
            });
         }
      } else {
         setMascotState('happy');
      }

    } else {
      playIncorrect();
      setMascotState('sad');
      setStreak(0);
      if (mode === QuizMode.SURVIVAL) {
        setLives(prev => Math.max(0, prev - 1));
      }
    }

    setAnswers(prev => [...prev, { 
      questionId: currentQuestion.id, 
      selectedIndex: index, 
      isCorrect 
    }]);

  }, [currentQuestion, mode, playCorrect, playIncorrect, streak]);

  const handleOptionSelect = useCallback((index: number) => {
    if (isAnswered || !currentQuestion) return;
    const isCorrect = index === currentQuestion.correctIndex;
    handleAnswer(index, isCorrect);
  }, [isAnswered, currentQuestion, handleAnswer]);

  const finishQuiz = useCallback(() => {
    const correctCount = answers.filter(a => a.isCorrect).length;
    onComplete({
      correctCount,
      totalQuestions: questions.length,
      score: correctCount * 10,
      mode,
      answers
    });
  }, [answers, onComplete, questions.length, mode]);

  const handleNext = useCallback(() => {
    playClick();
    setMascotState('idle');

    if (mode === QuizMode.SURVIVAL && lives === 0) {
      finishQuiz();
      return;
    }

    if (questions && currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      finishQuiz();
    }
  }, [currentIndex, questions?.length, mode, lives, playClick, finishQuiz]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      playClick();
      setMascotState('idle');
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      
      const prevQId = questions[prevIndex].id;
      const prevAnswer = answers.find(a => a.questionId === prevQId);
      
      if (prevAnswer) {
        setSelectedOption(prevAnswer.selectedIndex);
        setIsAnswered(true);
      } else {
        setSelectedOption(null);
        setIsAnswered(false);
      }
    }
  }, [currentIndex, questions, answers, playClick]);

  // --- TOGGLE GESTURE HANDLER ---
  const toggleGesture = () => {
    setIsGestureEnabled(prev => !prev);
  };

  // --- TIMER LOGIC ---
  useEffect(() => {
    if (mode !== QuizMode.TIME_RUSH || isAnswered || !currentQuestion) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          playIncorrect();
          handleAnswer(-1, false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, isAnswered, mode, currentQuestion, handleAnswer, playIncorrect]);

  useEffect(() => {
    if (mode === QuizMode.TIME_RUSH) setTimeLeft(20);
  }, [currentIndex, mode]);

  const jumpToQuestion = (index: number) => {
    if (mode === QuizMode.TIME_RUSH || mode === QuizMode.SURVIVAL) return;
    
    if (index <= answers.length) {
      setCurrentIndex(index);
      const existingAnswer = answers.find(a => a.questionId === questions[index].id);
      if (existingAnswer) {
        setSelectedOption(existingAnswer.selectedIndex);
        setIsAnswered(true);
      } else {
        setSelectedOption(null);
        setIsAnswered(false);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
         e.preventDefault(); 
         handlePrev();
         return;
      }
      if (e.key === 'Enter') {
         if (isAnswered) handleNext();
         return;
      }
      if (['1', '2', '3', '4'].includes(e.key)) {
         if (!isAnswered) {
            const idx = parseInt(e.key) - 1;
            if (currentQuestion && idx < currentQuestion.options.length) {
               handleOptionSelect(idx);
            }
         }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswered, currentQuestion, handleOptionSelect, handleNext, handlePrev]);

  const handleDeleteQuiz = () => {
    if (onDelete && confirm("Soal jelek? Yakin mau buang kuis ini?")) {
      onDelete();
    }
  };

  if (!currentQuestion) return <div className="p-10 text-center">Loading Question...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 relative">
      <QuizMascot state={mascotState} streak={streak} />
      
      {/* EXPERIMENTAL: GESTURE CONTROL UI */}
      {isGestureEnabled && (
        <GestureControl 
          onOptionSelect={handleOptionSelect}
          onNext={handleNext}
          onPrev={handlePrev}
          isAnswered={isAnswered}
        />
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        
        <div className="flex items-center gap-2">
          <button 
             onClick={onExit}
             className="p-2.5 bg-theme-glass border border-theme-border rounded-xl text-theme-muted hover:bg-theme-bg hover:text-theme-text transition-all shadow-sm"
             title="Menu Utama"
          >
             <LogOut size={18} />
          </button>
          
          {onDelete && (
            <button 
               onClick={handleDeleteQuiz}
               className="p-2.5 bg-theme-glass border border-theme-border rounded-xl text-rose-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm"
               title="Buang Soal"
            >
               <Trash2 size={18} />
            </button>
          )}

          <div className="w-px h-6 bg-theme-border mx-1" />

          {/* GESTURE TOGGLE */}
          <button
             onClick={toggleGesture}
             className={`p-2.5 border rounded-xl transition-all shadow-sm flex items-center gap-2 ${isGestureEnabled ? 'bg-theme-primary/10 border-theme-primary text-theme-primary' : 'bg-theme-glass border-theme-border text-theme-muted hover:text-theme-text'}`}
             title="Toggle Gesture Control (Experimental)"
          >
             <Hand size={18} />
          </button>

          <button 
             onClick={handlePrev}
             disabled={currentIndex === 0}
             className={`p-2.5 bg-theme-glass border border-theme-border rounded-xl transition-all shadow-sm ${currentIndex === 0 ? 'opacity-50 cursor-not-allowed text-theme-muted/50' : 'text-theme-muted hover:bg-theme-bg hover:text-theme-primary hover:border-theme-primary/50'}`}
          >
             <ArrowLeft size={18} />
          </button>

          <div className="ml-2 bg-theme-glass backdrop-blur-md px-4 py-2 rounded-2xl border border-theme-border text-theme-text font-semibold text-sm shadow-sm">
            {currentIndex + 1} <span className="text-theme-muted font-normal">/ {questions.length}</span>
          </div>
          
          <AnimatePresence>
            {streak > 1 && (
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="flex items-center bg-orange-100 text-orange-600 px-3 py-2 rounded-2xl border border-orange-200"
              >
                <Flame size={18} className="fill-orange-500 mr-1 animate-pulse" />
                <span className="font-bold text-sm">{streak}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* DOTS NAVIGATION */}
        <div className="flex-1 flex justify-center flex-wrap gap-1.5 px-4 overflow-x-auto max-w-full">
           {questions.map((q, idx) => {
             const answer = answers.find(a => a.questionId === q.id);
             let dotClass = "bg-theme-bg/30 border-theme-border";
             
             if (idx === currentIndex) dotClass = "bg-theme-primary border-theme-primary scale-110 shadow-md ring-2 ring-theme-primary/30";
             else if (answer?.isCorrect) dotClass = "bg-emerald-400 border-emerald-400";
             else if (answer && !answer.isCorrect) dotClass = "bg-rose-400 border-rose-400";
             
             return (
               <button
                 key={q.id}
                 onClick={() => jumpToQuestion(idx)}
                 className={`w-2.5 h-2.5 rounded-full border transition-all duration-300 ${dotClass}`}
                 title={`Question ${idx + 1}`}
               />
             );
           })}
        </div>

        <div className="flex items-center gap-2 justify-end">
           {mode === QuizMode.SURVIVAL && (
            <div className="flex items-center space-x-1 bg-rose-100 text-rose-600 px-3 py-2 rounded-2xl border border-rose-200">
              <Heart size={18} className="fill-rose-500" />
              <span className="font-bold text-sm">{lives}</span>
            </div>
          )}
           {mode === QuizMode.TIME_RUSH && (
            <div className={`flex items-center space-x-1 px-3 py-2 rounded-2xl border ${timeLeft < 5 ? 'bg-red-100 text-red-600 border-red-200' : 'bg-theme-primary/10 text-theme-primary border-theme-primary/30'}`}>
              <Clock size={18} />
              <span className="font-bold text-sm">{timeLeft}s</span>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode='wait'>
        <div className="relative">
          <QuestionCard
            key={currentIndex}
            question={currentQuestion}
            selectedOption={selectedOption}
            isAnswered={isAnswered}
            onOptionSelect={handleOptionSelect}
            onNext={handleNext}
            mode={mode}
            lives={lives}
            isLastQuestion={currentIndex === questions.length - 1}
          />
        </div>
      </AnimatePresence>
    </div>
  );
};
