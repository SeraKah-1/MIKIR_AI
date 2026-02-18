
/**
 * ==========================================
 * STORAGE SERVICE (Facade)
 * ==========================================
 * Mengatur LocalStorage dan menjembatani ke MikirCloud (Supabase).
 */

import { Question, ModelConfig, AiProvider, StorageProvider, CloudNote, LibraryItem } from "../types";
import { MikirCloud } from "./supabaseService"; 

const HISTORY_KEY = 'glassquiz_history';
const LIBRARY_KEY = 'glassquiz_library'; 
const GRAVEYARD_KEY = 'glassquiz_graveyard'; // NEW: Kuburan Soal
const GEMINI_KEY_STORAGE = 'glassquiz_api_key';
const GEMINI_KEYS_POOL = 'glassquiz_gemini_keys_pool'; 
const GROQ_KEY_STORAGE = 'glassquiz_groq_key';
const GROQ_KEYS_POOL = 'glassquiz_groq_keys_pool'; 
const STORAGE_PREF_KEY = 'glassquiz_storage_pref';
const SUPABASE_CONFIG_KEY = 'glassquiz_supabase_config';
const GESTURE_ENABLED_KEY = 'glassquiz_gesture_enabled';

// --- SETTINGS (GESTURE) ---
export const saveGestureEnabled = (enabled: boolean) => {
    localStorage.setItem(GESTURE_ENABLED_KEY, JSON.stringify(enabled));
};

export const getGestureEnabled = (): boolean => {
    const raw = localStorage.getItem(GESTURE_ENABLED_KEY);
    return raw ? JSON.parse(raw) : false; 
};

// --- MISTAKE GRAVEYARD (FEATURE #5) ---
export const addToGraveyard = (question: Question) => {
  try {
    const raw = localStorage.getItem(GRAVEYARD_KEY);
    let graveyard = raw ? JSON.parse(raw) : [];
    
    // Cek duplikasi berdasarkan ID atau Teks (agar hantu tidak kembar)
    const exists = graveyard.find((q: Question) => q.text === question.text);
    if (!exists) {
      graveyard.unshift({
        ...question,
        buriedAt: Date.now() // Timestamp kapan salah
      });
      localStorage.setItem(GRAVEYARD_KEY, JSON.stringify(graveyard));
    }
  } catch (e) {
    console.error("Gagal mengubur soal:", e);
  }
};

export const getGraveyard = (): any[] => {
  try {
    const raw = localStorage.getItem(GRAVEYARD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
};

export const removeFromGraveyard = (questionId: number) => {
  try {
    const raw = localStorage.getItem(GRAVEYARD_KEY);
    if (raw) {
      const graveyard = JSON.parse(raw);
      const newGraveyard = graveyard.filter((q: any) => q.id !== questionId);
      localStorage.setItem(GRAVEYARD_KEY, JSON.stringify(newGraveyard));
    }
  } catch (e) { console.error("Gagal membangkitkan soal", e); }
};

// --- API KEY MANAGEMENT (MULTI-KEY ROTATION) ---
export const saveApiKey = (provider: AiProvider, key: string) => {
  // Save as single key (Legacy compatibility)
  if (provider === 'gemini') localStorage.setItem(GEMINI_KEY_STORAGE, key);
  else localStorage.setItem(GROQ_KEY_STORAGE, key);
};

export const saveApiKeysPool = (provider: AiProvider, keys: string[]) => {
  const cleanKeys = keys.map(k => k.trim()).filter(k => k.length > 5);
  if (provider === 'gemini') localStorage.setItem(GEMINI_KEYS_POOL, JSON.stringify(cleanKeys));
  else localStorage.setItem(GROQ_KEYS_POOL, JSON.stringify(cleanKeys));
};

export const getApiKey = (provider: AiProvider = 'gemini'): string | null => {
  // 1. Check Pool (Priority: Multi-key rotation)
  const poolKey = provider === 'gemini' ? GEMINI_KEYS_POOL : GROQ_KEYS_POOL;
  const rawPool = localStorage.getItem(poolKey);
  
  if (rawPool) {
    try {
       const keys = JSON.parse(rawPool);
       if (Array.isArray(keys) && keys.length > 0) {
          // RANDOM ROTATION: Pick one random key from the pool
          // This spreads load across keys to avoid hitting rate limits on a single key.
          const randomIndex = Math.floor(Math.random() * keys.length);
          return keys[randomIndex];
       }
    } catch (e) {
       console.warn("Failed to parse key pool", e);
    }
  }

  // 2. Fallback to Single Key
  if (provider === 'gemini') return localStorage.getItem(GEMINI_KEY_STORAGE);
  else return localStorage.getItem(GROQ_KEY_STORAGE);
};

export const removeApiKey = (provider: AiProvider) => {
  if (provider === 'gemini') {
     localStorage.removeItem(GEMINI_KEY_STORAGE);
     localStorage.removeItem(GEMINI_KEYS_POOL);
  } else {
     localStorage.removeItem(GROQ_KEY_STORAGE);
     localStorage.removeItem(GROQ_KEYS_POOL);
  }
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

// --- LIBRARY MANAGEMENT (KNOWLEDGE BASE) ---

export const saveToLibrary = async (title: string, content: string, type: 'pdf' | 'text' | 'note', tags: string[] = []) => {
  const newItem: LibraryItem = {
    id: Date.now().toString(),
    title,
    content, // We store extracted text, NOT the binary file.
    type,
    tags,
    created_at: new Date().toISOString()
  };

  try {
    // 1. Local Storage
    const rawLib = localStorage.getItem(LIBRARY_KEY);
    const library = rawLib ? JSON.parse(rawLib) : [];
    
    // Strict Filter: Ensure we don't duplicate or mix bad data
    // Only save items that strictly have content
    if (content.length > 5) {
        library.unshift(newItem);
    }

    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
    } catch (e) {
      alert("Penyimpanan penuh! Hapus materi lama.");
      return;
    }

    // 2. Cloud (Supabase)
    const sbConfig = getSupabaseConfig();
    if (sbConfig) {
       // Mapping to neuro_notes table structure
       const notePayload = {
          id: newItem.id,
          timestamp: Date.now(),
          topic: newItem.title,
          content: newItem.content,
          mode: 'library',
          provider: newItem.type // storing type in provider col
       };
       await MikirCloud.notes.create(sbConfig, notePayload);
    }
  } catch (err) {
    console.error("Library Save Error:", err);
  }
};

export const getLibraryItems = async (): Promise<LibraryItem[]> => {
  const sbConfig = getSupabaseConfig();
  
  // Priority: Cloud if available, else Local
  if (sbConfig) {
    try {
      const notes = await MikirCloud.notes.list(sbConfig);
      // STRICT FILTERING: Ensure we only return Library Types
      // This prevents "Quiz History" or other data from polluting the library view
      return notes
        .filter(n => ['pdf', 'text', 'note', 'library'].includes((n.tags?.[1] as any) || n.tags?.[0] || ''))
        .map(n => ({
            id: n.id,
            title: n.title,
            content: n.content,
            type: (n.tags && n.tags[1] as any) || 'note',
            tags: n.tags || [],
            created_at: n.created_at
      }));
    } catch (e) {
      console.warn("Cloud fetch failed, falling back to local");
    }
  }

  const rawLib = localStorage.getItem(LIBRARY_KEY);
  if (!rawLib) return [];
  
  const parsed = JSON.parse(rawLib);
  // Ensure we only return array
  return Array.isArray(parsed) ? parsed : [];
};

export const deleteLibraryItem = async (id: string | number) => {
  // Local
  const rawLib = localStorage.getItem(LIBRARY_KEY);
  if (rawLib) {
    const library = JSON.parse(rawLib);
    const newLib = library.filter((item: LibraryItem) => String(item.id) !== String(id));
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(newLib));
  }

  // Cloud
  const sbConfig = getSupabaseConfig();
  if (sbConfig) {
    await MikirCloud.notes.delete(sbConfig, id);
  }
};

// --- WORKSPACE (QUIZ HISTORY) ---

export const saveGeneratedQuiz = async (file: File | null, config: ModelConfig, questions: Question[]) => {
  // Logic to determine filename: File -> Topic -> Library Context Summary
  let fileName = "Untitled Quiz";
  if (file) fileName = file.name;
  else if (config.topic) fileName = config.topic.split('\n')[0].substring(0, 50); // Use first line of topic
  
  const topicSummary = questions.length > 0 ? (questions[0].keyPoint || "General") : "General";

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
    const rawHistory = localStorage.getItem(HISTORY_KEY);
    const history = rawHistory ? JSON.parse(rawHistory) : [];
    history.unshift(newEntry);
    if (history.length > 50) history.pop(); 
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

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

// --- CLOUD OPERATIONS ---

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
    let safeQuestions = cloudQuiz.questions;
    if (typeof safeQuestions === 'string') {
        try { safeQuestions = JSON.parse(safeQuestions); } catch (e) { safeQuestions = []; }
    }
    const localQuiz = { 
        ...cloudQuiz, 
        id: Date.now(), 
        isCloud: false, 
        questions: safeQuestions || [] 
    };
    const rawHistory = localStorage.getItem(HISTORY_KEY);
    const history = rawHistory ? JSON.parse(rawHistory) : [];
    history.unshift(localQuiz);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch (error) {
    console.error("Download failed:", error);
    throw new Error("Gagal menyimpan data ke Local Storage.");
  }
};
