
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, ArrowLeft, Clock, Heart, Flame, Sparkles, Lightbulb, Volume2, LogOut, Trash2, Hand, AlertTriangle } from 'lucide-react';
import { Question, QuizResult, QuizMode } from '../types';
import { useGameSound } from '../hooks/useGameSound';
import { GestureControl } from './GestureControl';
import { getGestureEnabled, addToGraveyard } from '../services/storageService';
import { UniversalQuestionCard } from './UniversalQuestionCard'; 
import confetti from 'canvas-confetti';

const KAOMOJI_CORRECT = ["( ✧ ▽ ✧ )", "٩( ◕ ᗜ ◕ )و", "( ¬ ‿ ¬ )", "( b ᵔ ▽ ᵔ )b", "Nice!", "Hebat!", "Mantap!"];
const KAOMOJI_WRONG = ["( ≧Д≦)", "( ; ω ; )", "( ◡ _ ◡ )", "Yah...", "Coba lagi!", "Salah :("];

interface QuizInterfaceProps {
  questions: Question[];
  mode: QuizMode;
  onComplete: (result: QuizResult) => void;
  onExit: () => void;
  onDelete?: () => void;
}

export const QuizInterface: React.FC<QuizInterfaceProps> = ({ questions, mode, onComplete, onExit, onDelete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState<any>(null); 
  const [isAnswered, setIsAnswered] = useState(false);
  const [answers, setAnswers] = useState<{ questionId: number; selectedIndex: number; textAnswer?: string; isCorrect: boolean }[]>([]);
  const [feedbackKaomoji, setFeedbackKaomoji] = useState<{ text: string, type: 'good' | 'bad' } | null>(null);
  
  const { playCorrect, playIncorrect, playClick } = useGameSound();
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(20);
  const [isGestureEnabled, setIsGestureEnabled] = useState(false);

  useEffect(() => { setIsGestureEnabled(getGestureEnabled()); }, []);

  // --- KAOMOJI AUTO-DISMISS ---
  useEffect(() => {
    if (feedbackKaomoji) {
        const timer = setTimeout(() => {
            setFeedbackKaomoji(null);
        }, 1500); // Hilang setelah 1.5 detik
        return () => clearTimeout(timer);
    }
  }, [feedbackKaomoji]);

  // --- ANTI-CHEATING LOGIC ---
  useEffect(() => {
     const currentQ = questions[currentIndex];
     const existingAnswer = answers.find(a => a.questionId === currentQ.id);
     
     if (existingAnswer) {
        setUserAnswer(existingAnswer.textAnswer ? existingAnswer.textAnswer : existingAnswer.selectedIndex);
        setIsAnswered(true);
     } else {
        setUserAnswer(null);
        setIsAnswered(false);
        setFeedbackKaomoji(null);
     }
  }, [currentIndex, questions, answers]);

  const currentQuestion = (currentIndex < questions.length) ? questions[currentIndex] : null;

  const handleAnswer = useCallback((answerInput: any, isCorrect: boolean) => {
    if (!currentQuestion) return;
    if (answers.some(a => a.questionId === currentQuestion.id)) return;

    setUserAnswer(answerInput);
    setIsAnswered(true);

    if (isCorrect) {
      playCorrect();
      const newStreak = streak + 1;
      setStreak(newStreak);
      
      // Kaomoji Feedback
      const kao = KAOMOJI_CORRECT[Math.floor(Math.random() * KAOMOJI_CORRECT.length)];
      setFeedbackKaomoji({ text: newStreak > 2 ? `${kao} Combo x${newStreak}!` : kao, type: 'good' });

      if (newStreak >= 3 && newStreak % 3 === 0) {
         confetti({ particleCount: 30, spread: 60, origin: { y: 0.7 } });
      }
    } else {
      playIncorrect();
      setStreak(0);
      const kao = KAOMOJI_WRONG[Math.floor(Math.random() * KAOMOJI_WRONG.length)];
      setFeedbackKaomoji({ text: kao, type: 'bad' });

      // FEATURE 5: ADD TO GRAVEYARD
      addToGraveyard(currentQuestion);

      if (mode === QuizMode.SURVIVAL) setLives(prev => Math.max(0, prev - 1));
    }

    const answerRecord = { 
      questionId: currentQuestion.id, 
      selectedIndex: typeof answerInput === 'number' ? answerInput : -1,
      textAnswer: typeof answerInput === 'string' ? answerInput : undefined,
      isCorrect 
    };

    setAnswers(prev => [...prev, answerRecord]);
  }, [currentQuestion, mode, playCorrect, playIncorrect, streak, answers]);

  const handleNext = useCallback(() => {
    playClick();
    if (mode === QuizMode.SURVIVAL && lives === 0) {
      onComplete({ correctCount: answers.filter(a => a.isCorrect).length, totalQuestions: questions.length, score: 0, mode, answers });
      return;
    }
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onComplete({ correctCount: answers.filter(a => a.isCorrect).length, totalQuestions: questions.length, score: 0, mode, answers });
    }
  }, [currentIndex, questions.length, mode, lives, answers, onComplete, playClick]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      playClick();
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex, playClick]);

  // --- KEYBOARD LISTENER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Navigation (ENTER / SPACE)
      if (e.key === 'Enter') {
        // Jika soal Isian (Fill Blank) dan belum dijawab, jangan trigger Next dulu (biarkan form submit)
        if (currentQuestion?.type !== 'FILL_BLANK' || isAnswered) {
           handleNext();
        }
      } else if (e.key === ' ' && isAnswered) { 
        // Spasi hanya next jika sudah dijawab (biar gak kepencet pas lagi baca)
        e.preventDefault(); // Prevent scroll
        handleNext();
      }
      
      // 2. Answering (Only if NOT answered)
      else if (!isAnswered && currentQuestion) {
         // A. TRUE / FALSE Logic
         if (currentQuestion.type === 'TRUE_FALSE') {
            // 1 / B / T = Benar (Index 0)
            if (['1', 'b', 'B', 't', 'T'].includes(e.key)) handleAnswer(0, 0 === currentQuestion.correctIndex);
            // 2 / S / F = Salah (Index 1)
            if (['2', 's', 'S', 'f', 'F'].includes(e.key)) handleAnswer(1, 1 === currentQuestion.correctIndex);
         }
         
         // B. Multiple Choice Logic
         else if (currentQuestion.type === 'MULTIPLE_CHOICE' || !currentQuestion.type) {
            if (['1', 'a', 'A'].includes(e.key)) handleAnswer(0, 0 === currentQuestion.correctIndex);
            if (['2', 'b', 'B'].includes(e.key)) handleAnswer(1, 1 === currentQuestion.correctIndex);
            if (['3', 'c', 'C'].includes(e.key)) handleAnswer(2, 2 === currentQuestion.correctIndex);
            if (['4', 'd', 'D'].includes(e.key)) handleAnswer(3, 3 === currentQuestion.correctIndex);
         }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handleAnswer, isAnswered, currentQuestion]);

  const toggleGesture = () => setIsGestureEnabled(prev => !prev);

  const handleDelete = () => {
    if (onDelete && confirm("Soal ini ngaco/sampah? Hapus permanen quiz ini?")) {
      onDelete();
    }
  };

  // Timer Logic
  useEffect(() => {
    if (mode !== QuizMode.TIME_RUSH || isAnswered || !currentQuestion) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
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

  useEffect(() => { if (mode === QuizMode.TIME_RUSH) setTimeLeft(20); }, [currentIndex, mode]);

  if (!currentQuestion) return <div>Data Missing</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 relative">
      {/* KAOMOJI FLOATING FEEDBACK */}
      <AnimatePresence>
        {feedbackKaomoji && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            className={`fixed top-1/4 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-6 py-3 rounded-full shadow-2xl backdrop-blur-md border font-black text-xl tracking-wider
              ${feedbackKaomoji.type === 'good' ? 'bg-emerald-500/90 text-white border-emerald-400' : 'bg-rose-500/90 text-white border-rose-400'}
            `}
          >
            {feedbackKaomoji.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gesture Control */}
      {isGestureEnabled && currentQuestion.type !== 'FILL_BLANK' && (
        <GestureControl 
          onOptionSelect={(idx) => handleAnswer(idx, idx === currentQuestion.correctIndex)}
          onNext={handleNext}
          onPrev={handlePrev}
          isAnswered={isAnswered}
        />
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-2">
          <button onClick={onExit} className="p-2.5 bg-theme-glass border border-theme-border rounded-xl text-theme-muted hover:bg-theme-bg" title="Keluar"><LogOut size={18} /></button>
          
          <button onClick={toggleGesture} className={`p-2.5 border rounded-xl transition-all ${isGestureEnabled ? 'bg-theme-primary/10 border-theme-primary text-theme-primary' : 'bg-theme-glass border-theme-border text-theme-muted'}`}><Hand size={18} /></button>
          
          <button onClick={handlePrev} disabled={currentIndex === 0} className={`p-2.5 bg-theme-glass border border-theme-border rounded-xl ${currentIndex === 0 ? 'opacity-50' : 'hover:bg-theme-bg text-theme-muted'}`}><ArrowLeft size={18} /></button>
          
          <div className="ml-2 bg-theme-glass px-4 py-2 rounded-2xl border border-theme-border text-theme-text font-bold text-sm shadow-sm">{currentIndex + 1} <span className="text-theme-muted font-normal">/ {questions.length}</span></div>
          
          {streak > 1 && <div className="flex items-center bg-orange-100 text-orange-600 px-3 py-2 rounded-2xl border border-orange-200 shadow-sm"><Flame size={18} className="fill-orange-500 mr-1 animate-pulse" /><span className="font-bold text-sm">{streak}</span></div>}
        </div>
        
        <div className="flex items-center gap-2 justify-end">
           {onDelete && (
             <button onClick={handleDelete} className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-500 hover:bg-rose-100 transition-colors" title="Soal Sampah? Hapus Aja">
                <Trash2 size={18} />
             </button>
           )}

           {mode === QuizMode.SURVIVAL && <div className="flex items-center space-x-1 bg-rose-100 text-rose-600 px-3 py-2 rounded-2xl border border-rose-200"><Heart size={18} className="fill-rose-500" /><span className="font-bold text-sm">{lives}</span></div>}
           {mode === QuizMode.TIME_RUSH && <div className={`flex items-center space-x-1 px-3 py-2 rounded-2xl border ${timeLeft < 5 ? 'bg-red-100 text-red-600' : 'bg-theme-primary/10 text-theme-primary'}`}><Clock size={18} /><span className="font-bold text-sm">{timeLeft}s</span></div>}
        </div>
      </div>

      <AnimatePresence mode='wait'>
          <UniversalQuestionCard 
             key={currentIndex}
             question={currentQuestion}
             userAnswer={userAnswer}
             isAnswered={isAnswered}
             onAnswer={handleAnswer}
             onNext={handleNext}
          />
      </AnimatePresence>
    </div>
  );
};
