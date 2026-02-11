
/**
 * ==========================================
 * STORAGE SERVICE (Facade)
 * ==========================================
 * Mengatur LocalStorage dan menjembatani ke MikirCloud (Supabase).
 */

import { Question, ModelConfig, AiProvider, StorageProvider, CloudNote } from "../types";
import { MikirCloud } from "./supabaseService"; 

const HISTORY_KEY = 'glassquiz_history';
const GEMINI_KEY_STORAGE = 'glassquiz_api_key';
const GROQ_KEY_STORAGE = 'glassquiz_groq_key';
const STORAGE_PREF_KEY = 'glassquiz_storage_pref';
const SUPABASE_CONFIG_KEY = 'glassquiz_supabase_config';

// --- API KEY MANAGEMENT ---
export const saveApiKey = (provider: AiProvider, key: string) => {
  if (provider === 'gemini') localStorage.setItem(GEMINI_KEY_STORAGE, key);
  else localStorage.setItem(GROQ_KEY_STORAGE, key);
};

export const getApiKey = (provider: AiProvider = 'gemini'): string | null => {
  if (provider === 'gemini') return localStorage.getItem(GEMINI_KEY_STORAGE);
  else return localStorage.getItem(GROQ_KEY_STORAGE);
};

export const removeApiKey = (provider: AiProvider) => {
  if (provider === 'gemini') localStorage.removeItem(GEMINI_KEY_STORAGE);
  else localStorage.removeItem(GROQ_KEY_STORAGE);
};

// --- STORAGE CONFIGURATION ---
export const saveStorageConfig = (provider: StorageProvider, config?: { url: string, key: string }) => {
  localStorage.setItem(STORAGE_PREF_KEY, provider);
  if (config) localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
};

export const getStorageProvider = (): StorageProvider => {
  return (localStorage.getItem(STORAGE_PREF_KEY) as StorageProvider) || 'local';
};

export const getSupabaseConfig = () => {
  const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
  return raw ? JSON.parse(raw) : null;
};

// --- WORKSPACE (LOCAL STORAGE - SYNCHRONOUS OPTIMIZED) ---

export const saveGeneratedQuiz = async (file: File | null, config: ModelConfig, questions: Question[]) => {
  const topicSummary = questions.length > 0 ? (questions[0].keyPoint || "General") : "General";
  const fileName = file ? file.name : (config.topic || "Topik Manual");

  const newEntry = {
    id: Date.now(), 
    fileName: fileName,
    file_name: fileName, 
    modelId: config.modelId,
    mode: config.mode,
    provider: config.provider,
    date: new Date().toISOString(),
    questionCount: questions.length,
    topicSummary: topicSummary,
    questions: questions,
    lastScore: null,
    tags: [config.mode, config.examStyle]
  };

  try {
    // 1. Save to Local Storage (Sync is faster for LS)
    const rawHistory = localStorage.getItem(HISTORY_KEY);
    const history = rawHistory ? JSON.parse(rawHistory) : [];
    history.unshift(newEntry);
    
    // Limit local storage to 50 items to keep app light
    if (history.length > 50) history.pop(); 
    
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    // 2. Auto-Upload to Cloud (Fire and Forget - Non Blocking)
    const sbConfig = getSupabaseConfig();
    if (sbConfig) {
      MikirCloud.quiz.create(sbConfig, newEntry).catch(console.warn);
    }

  } catch (err) {
    console.error("Save Error:", err);
  }
};

export const getSavedQuizzes = async (): Promise<any[]> => {
  try {
    const rawHistory = localStorage.getItem(HISTORY_KEY);
    return rawHistory ? JSON.parse(rawHistory) : [];
  } catch (e) { return []; }
};

export const deleteQuiz = async (id: number | string) => {
  const rawHistory = localStorage.getItem(HISTORY_KEY);
  if (rawHistory) {
    const history = JSON.parse(rawHistory);
    const newHistory = history.filter((item: any) => String(item.id) !== String(id));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  }
};

export const renameQuiz = async (id: number | string, newName: string) => {
  const rawHistory = localStorage.getItem(HISTORY_KEY);
  if (rawHistory) {
    const history = JSON.parse(rawHistory);
    const newHistory = history.map((item: any) => 
      String(item.id) === String(id) ? { ...item, fileName: newName, file_name: newName } : item
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  }
};

export const updateLocalQuizQuestions = async (id: number | string, newQuestions: Question[]) => {
  const rawHistory = localStorage.getItem(HISTORY_KEY);
  if (rawHistory) {
    const history = JSON.parse(rawHistory);
    const newHistory = history.map((item: any) => 
      String(item.id) === String(id) ? { ...item, questions: newQuestions, questionCount: newQuestions.length } : item
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  }
};

export const updateHistoryStats = async (id: number | string, score: number) => {
  const rawHistory = localStorage.getItem(HISTORY_KEY);
  if (rawHistory) {
    const history = JSON.parse(rawHistory);
    const newHistory = history.map((item: any) => 
      String(item.id) === String(id) ? { ...item, lastScore: score, lastPlayed: new Date().toISOString() } : item
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  }
};

export const clearHistory = async () => {
  if (confirm("Hapus semua riwayat di MEJA KERJA (Local)? Data di Cloud aman.")) {
    localStorage.removeItem(HISTORY_KEY);
  }
};

// --- CLOUD OPERATIONS (Delegated to MikirCloud) ---

export const uploadToCloud = async (quiz: any) => {
  const sbConfig = getSupabaseConfig();
  if (!sbConfig) throw new Error("Supabase belum dikonfigurasi.");
  
  const payload = {
    ...quiz,
    fileName: quiz.fileName || quiz.file_name,
    topicSummary: quiz.topicSummary || quiz.topic_summary
  };
  
  return await MikirCloud.quiz.create(sbConfig, payload);
};

export const fetchCloudQuizzes = async () => {
  const sbConfig = getSupabaseConfig();
  if (!sbConfig) return [];
  return await MikirCloud.quiz.list(sbConfig);
};

export const deleteFromCloud = async (cloudId: number | string) => {
  const sbConfig = getSupabaseConfig();
  if (!sbConfig) return;
  return await MikirCloud.quiz.delete(sbConfig, cloudId);
};

export const updateCloudQuizQuestions = async (cloudId: number | string, newQuestions: Question[]) => {
  const sbConfig = getSupabaseConfig();
  if (!sbConfig) throw new Error("Supabase config missing");
  return await MikirCloud.quiz.updateQuestions(sbConfig, cloudId, newQuestions);
};

export const fetchNotesFromSupabase = async (): Promise<CloudNote[]> => {
  const sbConfig = getSupabaseConfig();
  if (!sbConfig) return [];
  return await MikirCloud.notes.list(sbConfig);
};

// --- UTILS ---
export const downloadFromCloud = async (cloudQuiz: any) => {
  try {
    // 1. Data Cleaning
    // Ensure questions is an Array, not stringified JSON
    let safeQuestions = cloudQuiz.questions;
    if (typeof safeQuestions === 'string') {
        try { safeQuestions = JSON.parse(safeQuestions); } catch (e) { safeQuestions = []; }
    }
    
    // 2. Create Clean Local Object
    // Generate NEW ID to prevent collision with existing data
    const localQuiz = { 
        ...cloudQuiz, 
        id: Date.now(), 
        isCloud: false, 
        questions: safeQuestions || [] 
    };

    // 3. Save to Local Storage directly
    const rawHistory = localStorage.getItem(HISTORY_KEY);
    const history = rawHistory ? JSON.parse(rawHistory) : [];
    
    // Prevent duplicate download logic (optional, based on filename + count)
    // For now we allow duplicates but with new IDs
    
    history.unshift(localQuiz);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    
    return true;
  } catch (error) {
    console.error("Download failed:", error);
    throw new Error("Gagal menyimpan data ke Local Storage.");
  }
};
