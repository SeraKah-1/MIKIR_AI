import { useEffect } from 'react';
import { getSupabaseConfig } from '../services/storageService';
import { MikirCloud } from '../services/supabaseService';
import { useAppStore } from '../store/useAppStore';

export const useAutoSave = () => {
  const { sessionMetadata, questions, originalQuestions, activeMode, lastConfig } = useAppStore();

  useEffect(() => {
    if (!sessionMetadata?.id || questions.length === 0) return;

    const config = getSupabaseConfig();
    if (!config) return;

    const timer = setTimeout(async () => {
      try {
        console.log("Auto-saving quiz to cloud...");
        await MikirCloud.quiz.upsert(
          config, 
          { 
            fileName: lastConfig?.config.topic || "Untitled Quiz",
            questions: originalQuestions,
            mode: activeMode,
            modelId: lastConfig?.config.modelId,
            topicSummary: lastConfig?.config.topic
          }, 
          sessionMetadata.id
        );
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, 5000); // 5 seconds debounce

    return () => clearTimeout(timer);
  }, [questions, originalQuestions, sessionMetadata?.id, lastConfig, activeMode]);
};
