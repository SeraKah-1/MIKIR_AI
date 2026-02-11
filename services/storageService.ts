
/**
 * ==========================================
 * STORAGE SERVICE (LOCAL STORAGE & SUPABASE)
 * ==========================================
 */

import { Question, ModelConfig, AiProvider, StorageProvider, CloudNote } from "../types";
import { getSupabaseClient } from "../lib/supabaseClient";

const HISTORY_KEY = 'glassquiz_history';
const FOLDERS_KEY = 'glassquiz_folders'; 
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
  const folders = getFolders().filter(f => f !== name);
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));

  const rawHistory = localStorage.getItem(HISTORY_KEY);
  if (rawHistory) {
    const history = JSON.parse(rawHistory);
    const newHistory = history.map((item: any) => 
      item.folder === name ? { ...item, folder: undefined } : item
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  }
};

// --- CLOUD NOTES INTEGRATION (CROSS-APP) ---
export const fetchNotesFromSupabase = async (): Promise<CloudNote[]> => {
  const sbConfig = getSupabaseConfig();
  if (!sbConfig) return []; // Supabase not configured

  try {
    const supabase = getSupabaseClient(sbConfig.url, sbConfig.key);
    
    // We assume the other app uses a table named 'notes'
    // We select id, title, content. Tags is optional.
    const { data, error } = await supabase
      .from('notes')
      .select('id, title, content, created_at, tags')
      .order('created_at', { ascending: false })
      .limit(20); // Limit to last 20 notes to avoid overload

    if (error) {
      console.error("Failed to fetch notes:", error);
      // Jangan throw error yang mematikan UI, kembalikan array kosong saja dengan log
      return [];
    }

    return data as CloudNote[];
  } catch (err) {
    console.error("Supabase Connection Error (Fetch Notes):", err);
    return [];
  }
};

// --- HELPER: SAVE TO LOCAL (Internal) ---
const saveToLocalStorage = (entry: any) => {
  try {
    const rawHistory = localStorage.getItem(HISTORY_KEY);
    const history = rawHistory ? JSON.parse(rawHistory) : [];
    
    // Map snake_case to camelCase for local consistency if needed, 
    // or simply store consistent object structure.
    const localEntry = {
        ...entry,
        fileName: entry.file_name, // Mapping for UI compatibility
        questionCount: entry.question_count,
        topicSummary: entry.topic_summary
    };

    history.unshift(localEntry);
    if (history.length > 50) history.pop(); // Keep last 50
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    console.log("Saved to Local Storage successfully.");
  } catch (err) {
    console.error("Local Storage Save Error (Quota Exceeded?):", err);
  }
};

// --- QUIZ HISTORY MANAGEMENT ---

export const saveGeneratedQuiz = async (
  file: File | null, 
  config: ModelConfig,
  questions: Question[]
) => {
  const provider = getStorageProvider();
  
  // 1. Prepare Data Object (Consistent for both DBs)
  const topicSummary = questions.length > 0 ? (questions[0].keyPoint || "General") : "General";
  const fileName = file ? file.name : (config.topic || "Topik Manual");

  const newEntry = {
    id: Date.now(), 
    file_name: fileName,
    model_id: config.modelId,
    mode: config.mode,
    provider: config.provider,
    date: new Date().toISOString(),
    created_at: new Date().toISOString(), // Supabase usually handles this, but good for local
    question_count: questions.length,
    topic_summary: topicSummary,
    questions: questions, // Supabase jsonb column
    folder: undefined 
  };

  // 2. Logic Branching
  if (provider === 'supabase') {
    const sbConfig = getSupabaseConfig();
    
    if (!sbConfig) {
      console.warn("Supabase provider selected but no config found. Falling back to local.");
      saveToLocalStorage(newEntry);
      return;
    }
    
    try {
      const supabase = getSupabaseClient(sbConfig.url, sbConfig.key);
      
      console.log("Attempting to save to Supabase...");
      
      // INSERT ke tabel 'generated_quizzes'
      // Pastikan nama kolom di database (snake_case) sesuai dengan key di sini
      const { error } = await supabase.from('generated_quizzes').insert({
         file_name: newEntry.file_name,
         model_id: newEntry.model_id,
         mode: newEntry.mode,
         topic_summary: newEntry.topic_summary,
         questions: newEntry.questions
         // id dan created_at biasanya auto-generated di Supabase
      });

      if (error) {
        throw new Error(`Supabase Insert Error: ${error.message} (${error.code})`);
      }
      
      console.log("Saved to Supabase successfully.");

    } catch (err) {
      console.error("CRITICAL: Failed to save to Supabase.", err);
      // FALLBACK: Jangan biarkan user kehilangan data. Simpan ke Local Storage.
      alert("Gagal menyimpan ke Supabase. Menyimpan ke Local Storage sebagai backup.");
      saveToLocalStorage(newEntry);
    }

  } else {
    // Local Storage Mode
    saveToLocalStorage(newEntry);
  }
};

export const getSavedQuizzes = async (): Promise<any[]> => {
  const provider = getStorageProvider();

  if (provider === 'supabase') {
    const sbConfig = getSupabaseConfig();
    if (!sbConfig) {
       // Fallback read local if config missing
       const rawHistory = localStorage.getItem(HISTORY_KEY);
       return rawHistory ? JSON.parse(rawHistory) : [];
    }

    try {
      const supabase = getSupabaseClient(sbConfig.url, sbConfig.key);
      const { data, error } = await supabase
        .from('generated_quizzes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Supabase Read Error:", error);
        throw error;
      }

      // Map Supabase (snake_case) result to App UI (camelCase) format
      return data.map(item => ({
        id: item.id,
        fileName: item.file_name,
        modelId: item.model_id,
        mode: item.mode,
        date: item.created_at,
        questionCount: Array.isArray(item.questions) ? item.questions.length : 0,
        topicSummary: item.topic_summary,
        questions: item.questions,
        folder: item.folder
      }));

    } catch (e) {
      console.warn("Supabase read failed, showing empty or local list?", e);
      // Option: Fallback to local list or return empty
      return [];
    }

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
     
     try {
       const supabase = getSupabaseClient(sbConfig.url, sbConfig.key);
       await supabase.from('generated_quizzes').delete().eq('id', id);
     } catch (e) {
       console.error("Delete failed", e);
     }
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
  // Rename is currently Local Only feature in this version 
  // Implementing Rename for Supabase requires an UPDATE query
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
  // Folder logic is purely local in this version as schema doesn't have folder_id
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
    console.warn("Bulk delete disabled for Supabase.");
    alert("Hapus semua dinonaktifkan untuk Supabase demi keamanan.");
  } else {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(FOLDERS_KEY);
  }
};
