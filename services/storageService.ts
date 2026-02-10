/**
 * ==========================================
 * STORAGE SERVICE (LOCAL STORAGE & SUPABASE)
 * ==========================================
 */

import { Question, ModelConfig, AiProvider, StorageProvider } from "../types";
import { getSupabaseClient } from "../lib/supabaseClient";

const HISTORY_KEY = 'glassquiz_history';
const FOLDERS_KEY = 'glassquiz_folders'; // New key for folder names
const GEMINI_KEY_STORAGE = 'glassquiz_api_key';
const GROQ_KEY_STORAGE = 'glassquiz_groq_key';
const STORAGE_PREF_KEY = 'glassquiz_storage_pref';
const SUPABASE_CONFIG_KEY = 'glassquiz_supabase_config';

// --- API KEY MANAGEMENT ---
export const saveApiKey = (provider: AiProvider, key: string) => {
  if (provider === 'gemini') {
    localStorage.setItem(GEMINI_KEY_STORAGE, key);
  } else {
    localStorage.setItem(GROQ_KEY_STORAGE, key);
  }
};

export const getApiKey = (provider: AiProvider = 'gemini'): string | null => {
  if (provider === 'gemini') {
    return localStorage.getItem(GEMINI_KEY_STORAGE);
  } else {
    return localStorage.getItem(GROQ_KEY_STORAGE);
  }
};

export const removeApiKey = (provider: AiProvider) => {
  if (provider === 'gemini') {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
  } else {
    localStorage.removeItem(GROQ_KEY_STORAGE);
  }
};

// --- STORAGE CONFIGURATION ---
export const saveStorageConfig = (provider: StorageProvider, config?: { url: string, key: string }) => {
  localStorage.setItem(STORAGE_PREF_KEY, provider);
  if (config) {
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
  }
};

export const getStorageProvider = (): StorageProvider => {
  return (localStorage.getItem(STORAGE_PREF_KEY) as StorageProvider) || 'local';
};

export const getSupabaseConfig = () => {
  const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
  return raw ? JSON.parse(raw) : null;
};

// --- FOLDER MANAGEMENT (Local Only for simplicity) ---
export const getFolders = (): string[] => {
  const raw = localStorage.getItem(FOLDERS_KEY);
  return raw ? JSON.parse(raw) : [];
};

export const createFolder = (name: string) => {
  const folders = getFolders();
  if (!folders.includes(name)) {
    folders.push(name);
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  }
};

export const deleteFolder = (name: string) => {
  // Only deletes the folder entry, items inside usually go to root or get deleted separately
  // For this app: items inside go back to root (folder: undefined)
  const folders = getFolders().filter(f => f !== name);
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));

  // Move items to root
  const rawHistory = localStorage.getItem(HISTORY_KEY);
  if (rawHistory) {
    const history = JSON.parse(rawHistory);
    const newHistory = history.map((item: any) => 
      item.folder === name ? { ...item, folder: undefined } : item
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  }
};

// --- QUIZ HISTORY MANAGEMENT (ASYNC NOW) ---

export const saveGeneratedQuiz = async (
  file: File | null, 
  config: ModelConfig,
  questions: Question[]
) => {
  const provider = getStorageProvider();
  
  const newEntry = {
    id: Date.now(), // For Local, Supabase uses auto-inc ID usually, but we can pass metadata
    file_name: file ? file.name : (config.topic || "Topik Manual"),
    model_id: config.modelId,
    mode: config.mode,
    provider: config.provider,
    date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    question_count: questions.length,
    topic_summary: questions.length > 0 ? questions[0].keyPoint : "General",
    questions: questions,
    folder: undefined // Default root
  };

  if (provider === 'supabase') {
    const sbConfig = getSupabaseConfig();
    if (!sbConfig) throw new Error("Supabase config missing");
    
    const supabase = getSupabaseClient(sbConfig.url, sbConfig.key);
    
    // Map to snake_case for Supabase table if needed, or keep as jsonb
    const { error } = await supabase.from('generated_quizzes').insert({
       file_name: newEntry.file_name,
       model_id: newEntry.model_id,
       mode: newEntry.mode,
       topic_summary: newEntry.topic_summary,
       questions: newEntry.questions
    });

    if (error) throw new Error(error.message);

  } else {
    // Local Storage Logic
    try {
      const rawHistory = localStorage.getItem(HISTORY_KEY);
      const history = rawHistory ? JSON.parse(rawHistory) : [];
      
      // Adapt flat structure for consistency
      const localEntry = {
         ...newEntry,
         fileName: newEntry.file_name,
         questionCount: newEntry.question_count,
         topicSummary: newEntry.topic_summary
      };

      history.unshift(localEntry);
      // Limit local history to 50 items to prevent storage overflow
      if (history.length > 50) history.pop();
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (err) {
      console.error("Local Storage Save Error:", err);
    }
  }
};

export const getSavedQuizzes = async (): Promise<any[]> => {
  const provider = getStorageProvider();

  if (provider === 'supabase') {
    const sbConfig = getSupabaseConfig();
    if (!sbConfig) return [];

    const supabase = getSupabaseClient(sbConfig.url, sbConfig.key);
    const { data, error } = await supabase
      .from('generated_quizzes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Supabase Error:", error);
      return [];
    }

    // Normalizing data to match local structure
    return data.map(item => ({
      id: item.id,
      fileName: item.file_name,
      modelId: item.model_id,
      mode: item.mode,
      date: item.created_at,
      questionCount: Array.isArray(item.questions) ? item.questions.length : 0,
      topicSummary: item.topic_summary,
      questions: item.questions,
      folder: item.folder // Support folder column if added to supabase later
    }));

  } else {
    try {
      const rawHistory = localStorage.getItem(HISTORY_KEY);
      return rawHistory ? JSON.parse(rawHistory) : [];
    } catch (e) {
      return [];
    }
  }
};

export const deleteQuiz = async (id: number | string) => {
  const provider = getStorageProvider();

  if (provider === 'supabase') {
     const sbConfig = getSupabaseConfig();
     if (!sbConfig) return;
     
     const supabase = getSupabaseClient(sbConfig.url, sbConfig.key);
     await supabase.from('generated_quizzes').delete().eq('id', id);
  } else {
     const rawHistory = localStorage.getItem(HISTORY_KEY);
     if (rawHistory) {
       const history = JSON.parse(rawHistory);
       const newHistory = history.filter((item: any) => item.id !== id);
       localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
     }
  }
}

export const renameQuiz = (id: number | string, newName: string) => {
  const rawHistory = localStorage.getItem(HISTORY_KEY);
  if (rawHistory) {
    const history = JSON.parse(rawHistory);
    const newHistory = history.map((item: any) => 
      item.id === id ? { ...item, fileName: newName, file_name: newName } : item
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  }
};

export const moveQuizToFolder = (id: number | string, folderName: string | undefined) => {
  const rawHistory = localStorage.getItem(HISTORY_KEY);
  if (rawHistory) {
    const history = JSON.parse(rawHistory);
    const newHistory = history.map((item: any) => 
      item.id === id ? { ...item, folder: folderName } : item
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  }
};

export const clearHistory = async () => {
  const provider = getStorageProvider();
  
  if (provider === 'supabase') {
    console.warn("Bulk delete disabled for Supabase to prevent accidents.");
    alert("Hapus semua dinonaktifkan untuk Supabase demi keamanan.");
  } else {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(FOLDERS_KEY);
  }
};
