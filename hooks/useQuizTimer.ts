import { useState, useEffect, useRef } from 'react';
import { QuizMode } from '../types';
import { useAppStore } from '../store/useAppStore';

export const useQuizTimer = (
  currentIndex: number,
  isAnswered: boolean,
  handleAnswer: (answerInput: any, isCorrect: boolean) => void
) => {
  const { activeMode: mode } = useAppStore();
  const [timeLeft, setTimeLeft] = useState(20);
  const timeLeftRef = useRef(20);
  const handleAnswerRef = useRef(handleAnswer);

  useEffect(() => {
    handleAnswerRef.current = handleAnswer;
  }, [handleAnswer]);

  useEffect(() => {
    // Timer disabled for now as Time Rush mode is removed
    return;
  }, [currentIndex, mode, isAnswered]);

  return { timeLeft, timeLeftRef, setTimeLeft };
};
