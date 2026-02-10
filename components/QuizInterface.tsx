import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, ArrowLeft, Clock, Heart, Flame, Sparkles, Lightbulb, Volume2, Mic, Bot, LogOut } from 'lucide-react';
import { Question, QuizResult, QuizMode } from '../types';
import { GlassButton } from './GlassButton';
import { useGameSound } from '../hooks/useGameSound';
import { explainQuestionDeeper } from '../services/geminiService';
import { getApiKey } from '../services/storageService';

// --- Utility: Formatted Text Renderer (Markdown-like) ---
const FormattedText: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
           return <strong key={i} className="font-bold text-indigo-900">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
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
  
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setAiExplanation(null);
    setIsLoadingAI(false);
    
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [question?.id]);

  const speakQuestion = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!('speechSynthesis' in window)) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    playClick();
    setSpeaking(true);

    const textToSpeak = `${question.text}. Pilihan jawaban: ${question.options.join(', ')}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'id-ID'; 
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const handleDeepDive = async () => {
    const key = getApiKey();
    if (!key) return;

    setIsLoadingAI(true);
    playClick();
    try {
      const explanation = await explainQuestionDeeper(key, question);
      setAiExplanation(explanation);
    } catch (e) {
      setAiExplanation("Gagal memuat penjelasan.");
    } finally {
      setIsLoadingAI(false);
    }
  };

  if (!question) return null;

  const cardVariants = {
    hidden: { opacity: 0, x: 50, scale: 0.95 },
    visible: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -50, scale: 0.95 },
  };

  const optionVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05 } }),
  };

  const safeOptions = Array.isArray(question.options) ? question.options : ["Error: Invalid Options"];
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
      <div className="bg-white/50 backdrop-blur-2xl border border-white/80 rounded-[2rem] p-6 md:p-10 shadow-xl shadow-indigo-500/10 relative">
        
        {/* Key Point Badge */}
        <div className="flex justify-center mb-6">
           <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-wider shadow-sm">
             <Sparkles size={12} className="mr-2" />
             {question.keyPoint || "Konsep Kunci"}
           </span>
        </div>

        {/* TTS Button */}
        <button 
          onClick={speakQuestion}
          className={`
            absolute top-6 right-6 p-2 rounded-full transition-all duration-200
            ${speaking ? 'bg-indigo-100 text-indigo-600 animate-pulse' : 'bg-white/50 text-slate-400 hover:bg-white hover:text-indigo-500'}
          `}
          title="Bacakan Soal"
        >
          {speaking ? <Volume2 size={20} /> : <Mic size={20} />}
        </button>

        {/* Question Text */}
        <h2 className="text-xl md:text-2xl font-medium text-slate-800 text-center mb-8 leading-snug tracking-tight px-8">
          <FormattedText text={question.text} />
        </h2>

        {/* Options */}
        <div className="grid grid-cols-1 gap-3">
          {safeOptions.map((option, idx) => {
            let styles = "bg-white/70 border-white/60 text-slate-600 hover:bg-white hover:border-indigo-200";
            
            if (isAnswered) {
               if (idx === question.correctIndex) {
                 styles = "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-500/20";
               } else if (idx === selectedOption) {
                 styles = "bg-rose-100 border-rose-200 text-rose-500 opacity-80";
               } else {
                 styles = "bg-slate-50 border-transparent text-slate-300 opacity-50";
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
                {/* Keyboard Shortcut Hint */}
                <span className={`
                  hidden md:flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold mr-4 border transition-colors
                  ${isAnswered 
                    ? 'border-transparent bg-white/20 text-current' 
                    : 'border-slate-300 text-slate-400 bg-white group-hover:border-indigo-300 group-hover:text-indigo-500'}
                `}>
                  {shortcuts[idx]}
                </span>

                {/* Option Text */}
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

      {/* Feedback Panel */}
      <AnimatePresence>
        {isAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-4"
          >
            {/* Main Explanation */}
            <div className={`
              rounded-3xl p-6 border-2 
              ${selectedOption === question.correctIndex 
                ? 'bg-emerald-50/80 border-emerald-100' 
                : 'bg-white/60 border-indigo-100'}
            `}>
              <div className="flex items-start gap-4">
                 <div className={`p-3 rounded-2xl shrink-0 ${selectedOption === question.correctIndex ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                   <Lightbulb size={24} />
                 </div>
                 <div className="flex-1">
                   <h3 className="font-bold text-slate-800 text-lg mb-1">
                     {selectedOption === question.correctIndex ? "Tepat Sekali!" : "Pembahasan"}
                   </h3>
                   <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                     <FormattedText text={question.explanation} />
                   </p>

                    {/* AI Deep Dive Button */}
                   {!aiExplanation && !isLoadingAI && (
                     <button 
                      onClick={handleDeepDive}
                      className="mt-3 flex items-center text-xs font-medium text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-2 rounded-xl transition-all"
                     >
                       <Bot size={14} className="mr-2" /> Tanya AI (Analogi Sederhana)
                     </button>
                   )}
                 </div>
              </div>

               {/* AI Deep Dive Result */}
               {isLoadingAI && (
                  <div className="mt-4 p-4 bg-indigo-50 rounded-xl flex items-center justify-center space-x-2 text-indigo-500 text-sm animate-pulse">
                    <Sparkles size={16} /> <span>Sedang berpikir...</span>
                  </div>
               )}

               {aiExplanation && (
                 <motion.div 
                   initial={{ opacity: 0, height: 0 }} 
                   animate={{ opacity: 1, height: 'auto' }}
                   className="mt-4 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl"
                 >
                   <div className="flex items-start gap-3">
                     <Bot size={18} className="text-indigo-500 mt-1 shrink-0" />
                     <p className="text-sm text-slate-700 italic"><FormattedText text={aiExplanation} /></p>
                   </div>
                 </motion.div>
               )}
              
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

// --- Main Container ---

interface QuizInterfaceProps {
  questions: Question[];
  mode: QuizMode;
  onComplete: (result: QuizResult) => void;
  onExit: () => void;
}

export const QuizInterface: React.FC<QuizInterfaceProps> = ({ questions, mode, onComplete, onExit }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [answers, setAnswers] = useState<{ questionId: number; selectedIndex: number; isCorrect: boolean }[]>([]);
  
  // Audio Hooks
  const { playCorrect, playIncorrect, playClick } = useGameSound();

  // Gamification States
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(20);

  const currentQuestion = questions[currentIndex];

  // Timer Logic
  useEffect(() => {
    if (mode !== QuizMode.TIME_RUSH || isAnswered) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, isAnswered, mode]);

  useEffect(() => {
    if (mode === QuizMode.TIME_RUSH) setTimeLeft(20);
  }, [currentIndex, mode]);

  const handleTimeOut = () => {
    playIncorrect(); // Sound
    handleAnswer(-1, false);
  };

  const handleAnswer = useCallback((index: number, isCorrect: boolean) => {
    setSelectedOption(index);
    setIsAnswered(true);

    // Play Sound
    if (isCorrect) {
      playCorrect();
    } else {
      playIncorrect();
    }

    setAnswers(prev => [...prev, { 
      questionId: currentQuestion.id, 
      selectedIndex: index, 
      isCorrect 
    }]);

    if (isCorrect) {
      setStreak(prev => prev + 1);
    } else {
      setStreak(0);
      if (mode === QuizMode.SURVIVAL) {
        setLives(prev => Math.max(0, prev - 1));
      }
    }
  }, [currentQuestion, mode, playCorrect, playIncorrect]);

  const handleOptionSelect = useCallback((index: number) => {
    if (isAnswered) return;
    const isCorrect = index === currentQuestion.correctIndex;
    handleAnswer(index, isCorrect);
  }, [isAnswered, currentQuestion, handleAnswer]);

  const handleNext = useCallback(() => {
    playClick(); // Sound for next button
    if (mode === QuizMode.SURVIVAL && lives === 0) {
      finishQuiz();
      return;
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null); // Reset for next question
      setIsAnswered(false);    // Reset for next question
    } else {
      finishQuiz();
    }
  }, [currentIndex, questions.length, mode, lives, playClick]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      playClick();
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      
      // Restore state for previous question
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

  const finishQuiz = () => {
    const correctCount = answers.filter(a => a.isCorrect).length;
    onComplete({
      correctCount,
      totalQuestions: questions.length,
      score: correctCount * 10,
      mode,
      answers
    });
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space for Previous
      if (e.key === ' ' || e.code === 'Space') {
         e.preventDefault(); // Prevent scrolling
         handlePrev();
         return;
      }
      
      // Enter for Next (only if answered)
      if (e.key === 'Enter') {
         if (isAnswered) handleNext();
         return;
      }

      // Numbers for options
      if (['1', '2', '3', '4'].includes(e.key)) {
         if (!isAnswered) {
            const idx = parseInt(e.key) - 1;
            // Safe check if option exists
            if (currentQuestion && idx < currentQuestion.options.length) {
               handleOptionSelect(idx);
            }
         }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswered, currentQuestion, handleOptionSelect, handleNext, handlePrev]);

  if (!questions || questions.length === 0) {
    return <div className="text-center p-10 text-slate-500">Error: Tidak ada soal yang dimuat.</div>;
  }
  if (!currentQuestion) return null;

  return (
    <div className="max-w-3xl mx-auto px-4">
      {/* Header Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        
        {/* Left Controls: Exit & Back */}
        <div className="flex items-center gap-2">
          <button 
             onClick={onExit}
             className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm"
             title="Menu Utama"
          >
             <LogOut size={18} />
          </button>
          
          <button 
             onClick={handlePrev}
             disabled={currentIndex === 0}
             className={`p-2.5 bg-white border border-slate-200 rounded-xl transition-all shadow-sm ${currentIndex === 0 ? 'opacity-50 cursor-not-allowed text-slate-300' : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'}`}
             title="Soal Sebelumnya (Spasi)"
          >
             <ArrowLeft size={18} />
          </button>

          <div className="ml-2 bg-white/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/50 text-slate-600 font-semibold text-sm shadow-sm">
            {currentIndex + 1} <span className="text-slate-400 font-normal">/ {questions.length}</span>
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

        {/* Navigation Dots */}
        <div className="flex-1 flex justify-center flex-wrap gap-1.5 px-4 overflow-x-auto max-w-full">
           {questions.map((q, idx) => {
             const answer = answers.find(a => a.questionId === q.id);
             let dotClass = "bg-white/30 border-slate-200";
             
             if (idx === currentIndex) dotClass = "bg-indigo-500 border-indigo-500 scale-110 shadow-md ring-2 ring-indigo-200";
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
           {/* Sound Indicator */}
           <div className="hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-indigo-50 text-indigo-400 opacity-50">
             <Volume2 size={14} />
           </div>

           {mode === QuizMode.SURVIVAL && (
            <div className="flex items-center space-x-1 bg-rose-100 text-rose-600 px-3 py-2 rounded-2xl border border-rose-200">
              <Heart size={18} className="fill-rose-500" />
              <span className="font-bold text-sm">{lives}</span>
            </div>
          )}
           {mode === QuizMode.TIME_RUSH && (
            <div className={`flex items-center space-x-1 px-3 py-2 rounded-2xl border ${timeLeft < 5 ? 'bg-red-100 text-red-600 border-red-200' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}>
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