
/**
 * ==========================================
 * STORAGE SERVICE (Facade)
 * ==========================================
 * Mengatur LocalStorage, IndexedDB (untuk data besar), dan Supabase.
 */

import { Question, ModelConfig, AiProvider, StorageProvider, CloudNote, LibraryItem } from "../types";
import { MikirCloud } from "./supabaseService"; 
import { summarizeMaterial } from "./geminiService";
import { notifySupabaseError } from "./kaomojiNotificationService";
import { get, set, update } from 'idb-keyval'; // IndexedDB Wrapper

const HISTORY_KEY = 'glassquiz_history';
const LIBRARY_IDB_KEY = 'glassquiz_library_store'; // Key for IndexedDB
const GRAVEYARD_KEY = 'glassquiz_graveyard'; 
const GEMINI_KEY_STORAGE = 'glassquiz_api_key';
const GEMINI_KEYS_POOL = 'glassquiz_gemini_keys_pool'; 
const GROQ_KEY_STORAGE = 'glassquiz_groq_key';
const GROQ_KEYS_POOL = 'glassquiz_groq_keys_pool'; 
const STORAGE_PREF_KEY = 'glassquiz_storage_pref';
const SUPABASE_CONFIG_KEY = 'glassquiz_supabase_config';
const GESTURE_ENABLED_KEY = 'glassquiz_gesture_enabled';
const EYE_TRACKING_ENABLED_KEY = 'glassquiz_eye_tracking_enabled';

// --- SETTINGS (GESTURE & EYE TRACKING) ---
export const saveGestureEnabled = (enabled: boolean) => {
    localStorage.setItem(GESTURE_ENABLED_KEY, JSON.stringify(enabled));
};

export const getGestureEnabled = (): boolean => {
    const raw = localStorage.getItem(GESTURE_ENABLED_KEY);
    return raw ? JSON.parse(raw) : false; 
};

export const saveEyeTrackingEnabled = (enabled: boolean) => {
    localStorage.setItem(EYE_TRACKING_ENABLED_KEY, JSON.stringify(enabled));
};

export const getEyeTrackingEnabled = (): boolean => {
    const raw = localStorage.getItem(EYE_TRACKING_ENABLED_KEY);
    return raw ? JSON.parse(raw) : false; 
};

// --- MISTAKE GRAVEYARD ---
export const addToGraveyard = (question: Question) => {
  try {
    const raw = localStorage.getItem(GRAVEYARD_KEY);
    let graveyard = raw ? JSON.parse(raw) : [];
    const exists = graveyard.find((q: Question) => q.text === question.text);
    if (!exists) {
      graveyard.unshift({ ...question, buriedAt: Date.now() });
      localStorage.setItem(GRAVEYARD_KEY, JSON.stringify(graveyard));
    }
  } catch (e) { console.error("Gagal mengubur soal:", e); }
};

export const getGraveyard = (): any[] => {
  try {
    const raw = localStorage.getItem(GRAVEYARD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
};

export const removeFromGraveyard = (text: string) => {
  try {
    const raw = localStorage.getItem(GRAVEYARD_KEY);
    if (raw) {
      const graveyard = JSON.parse(raw);
      const newGraveyard = graveyard.filter((q: any) => q.text !== text);
      localStorage.setItem(GRAVEYARD_KEY, JSON.stringify(newGraveyard));
    }
  } catch (e) { console.error("Gagal membangkitkan soal", e); }
};

// --- API KEY MANAGEMENT ---
export const saveApiKey = (provider: AiProvider, key: string) => {
  if (provider === 'gemini') localStorage.setItem(GEMINI_KEY_STORAGE, key);
  else localStorage.setItem(GROQ_KEY_STORAGE, key);
};

export const saveApiKeysPool = (provider: AiProvider, keys: string[]) => {
  const cleanKeys = keys.map(k => k.trim()).filter(k => k.length > 5);
  if (provider === 'gemini') localStorage.setItem(GEMINI_KEYS_POOL, JSON.stringify(cleanKeys));
  else localStorage.setItem(GROQ_KEYS_POOL, JSON.stringify(cleanKeys));
};

export const getApiKey = (provider: AiProvider = 'gemini'): string | null => {
  // 1. Check Pool (LocalStorage) - Highest Priority (Keycard Multi-key)
  const poolKey = provider === 'gemini' ? GEMINI_KEYS_POOL : GROQ_KEYS_POOL;
  const rawPool = localStorage.getItem(poolKey);
  if (rawPool) {
    try {
       const keys = JSON.parse(rawPool);
       if (Array.isArray(keys) && keys.length > 0) {
          const randomIndex = Math.floor(Math.random() * keys.length);
          return keys[randomIndex];
       }
    } catch (e) { console.warn("Failed to parse key pool", e); }
  }

  // 2. Check Single Key (LocalStorage) - Priority (Keycard Single-key / Manual Input)
  let storedKey = null;
  if (provider === 'gemini') storedKey = localStorage.getItem(GEMINI_KEY_STORAGE);
  else storedKey = localStorage.getItem(GROQ_KEY_STORAGE);

  if (storedKey) return storedKey;

  // 3. Fallback to Environment Variables (.env)
  // This allows developers or deployments with env vars to work without keycard
  if (provider === 'gemini') {
      // Check standard Vite env vars first (exposed via define in vite.config.ts)
      if (typeof process !== 'undefined' && process.env) {
          if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
          if (process.env.API_KEY) return process.env.API_KEY;
      }
      // Check import.meta.env for Vite (if process.env is polyfilled but empty)
      if (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
          return import.meta.env.VITE_GEMINI_API_KEY;
      }
  } 
  
  // Groq env var support (optional)
  if (provider === 'groq') {
      if (typeof process !== 'undefined' && process.env && process.env.GROQ_API_KEY) {
          return process.env.GROQ_API_KEY;
      }
      if (import.meta.env && import.meta.env.VITE_GROQ_API_KEY) {
          return import.meta.env.VITE_GROQ_API_KEY;
      }
  }

  return null;
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

// --- LIBRARY MANAGEMENT (Smart Ingest Implementation) ---

export const processAndSaveToLibrary = async (title: string, rawContent: string, type: 'pdf' | 'text' | 'note') => {
    let processed = "";
    
    // Try to summarize using Gemini if Key is available
    const geminiKey = getApiKey('gemini');
    
    if (geminiKey) {
        try {
            // Only use heavy model if content justifies it (> 500 chars)
            if (rawContent.length > 500) {
                processed = await summarizeMaterial(geminiKey, rawContent);
            } else {
                processed = rawContent;
            }
        } catch (e) {
            console.warn("Auto-ingest failed, falling back to raw content", e);
            processed = rawContent;
        }
    } else {
        processed = rawContent; // Fallback if no key
    }

    await saveToLibrary(title, rawContent, processed, type);
};

// Helper to re-process an existing item (e.g. triggered manually)
export const reprocessLibraryItem = async (item: LibraryItem): Promise<boolean> => {
    const geminiKey = getApiKey('gemini');
    if (!geminiKey) return false;

    try {
        const processed = await summarizeMaterial(geminiKey, item.content);
        await updateLibraryItem(item.id, { processedContent: processed });
        return true;
    } catch (e) {
        console.error("Reprocess failed", e);
        return false;
    }
};

export const updateLibraryItem = async (id: string | number, updates: Partial<LibraryItem>) => {
    // 1. Update Local (IndexedDB)
    try {
        await update(LIBRARY_IDB_KEY, (val) => {
            const library = val || [];
            return library.map((item: LibraryItem) => 
                String(item.id) === String(id) ? { ...item, ...updates } : item
            );
        });
    } catch(e) { console.error("IDB Update failed", e); }

    // 2. Update Cloud (Using the specific Library Module)
    const sbConfig = getSupabaseConfig();
    if (sbConfig) {
        try {
            if (updates.processedContent || updates.content) {
                 await MikirCloud.library.update(sbConfig, id, updates);
            }
        } catch (e) { console.warn("Cloud sync failed (Update)"); }
    }
};

export const saveToLibrary = async (title: string, content: string, processedContent: string, type: 'pdf' | 'text' | 'note', tags: string[] = []) => {
  const newItem: LibraryItem = {
    id: Date.now().toString(),
    title,
    content, // Original Raw Text
    processedContent, // AI Summarized Text (Lightweight)
    type,
    tags,
    created_at: new Date().toISOString()
  };

  try {
    // 1. IndexedDB (Primary Local Storage)
    await update(LIBRARY_IDB_KEY, (val) => {
        const library = val || [];
        return [newItem, ...library];
    });

    // 2. Cloud (Supabase) - Sync if connected
    const sbConfig = getSupabaseConfig();
    if (sbConfig) {
       await MikirCloud.library.create(sbConfig, newItem).catch(e => {
           console.error("Cloud Library Save Failed:", e);
           notifySupabaseError();
       });
    }
  } catch (err) {
    console.error("Library Save Error:", err);
    alert("Gagal menyimpan materi. Cek memori browser.");
  }
};

export const getLibraryItems = async (): Promise<LibraryItem[]> => {
  let localItems: LibraryItem[] = [];
  let cloudItems: LibraryItem[] = [];

  // 1. Get Local (IndexedDB)
  try {
    localItems = (await get(LIBRARY_IDB_KEY)) || [];
  } catch (e) { 
      // Fallback for migration: try localstorage once
      const rawLib = localStorage.getItem('glassquiz_library');
      if (rawLib) {
          localItems = JSON.parse(rawLib);
          // Migrate to IDB
          await set(LIBRARY_IDB_KEY, localItems);
          localStorage.removeItem('glassquiz_library');
      }
  }

  // 2. Get Cloud (if config exists)
  const sbConfig = getSupabaseConfig();
  if (sbConfig) {
    try {
      cloudItems = await MikirCloud.library.list(sbConfig);
    } catch (e) {
      console.warn("Cloud fetch failed", e);
    }
  }

  // 3. MERGE STRATEGY: Combine both, remove duplicates based on ID or approximate matching
  const uniqueMap = new Map();
  
  const addToMap = (item: LibraryItem, isCloud: boolean) => {
      if (!uniqueMap.has(String(item.id))) {
          uniqueMap.set(String(item.id), { ...item, isCloudSource: isCloud });
      } else {
          // If collision, prefer the one with better content or default to Cloud
          const existing = uniqueMap.get(String(item.id));
          if (!existing.processedContent && item.processedContent) {
              uniqueMap.set(String(item.id), { ...item, isCloudSource: isCloud });
          }
      }
  };

  // Cloud items first (authoritative), then Local
  cloudItems.forEach(i => addToMap(i, true));
  localItems.forEach(i => addToMap(i, false));

  return Array.from(uniqueMap.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};

export const deleteLibraryItem = async (id: string | number) => {
  // Delete from IDB
  await update(LIBRARY_IDB_KEY, (val) => {
      const library = val || [];
      return library.filter((item: LibraryItem) => String(item.id) !== String(id));
  });

  const sbConfig = getSupabaseConfig();
  if (sbConfig) {
    await MikirCloud.library.delete(sbConfig, id).catch(e => console.warn("Cloud delete failed"));
  }
};

// --- WORKSPACE (QUIZ HISTORY) ---
export const saveGeneratedQuiz = async (file: File | null, config: ModelConfig, questions: Question[]) => {
  let fileName = "Untitled Quiz";
  if (file) fileName = file.name;
  else if (config.topic) fileName = config.topic.split('\n')[0].substring(0, 50); 
  
  const topicSummary = questions.length > 0 ? (questions[0].keyPoint || "General") : "General";

  // Handle tags for array or single examStyle
  const styleTags = Array.isArray(config.examStyle) ? config.examStyle : [config.examStyle];

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
    tags: [config.mode, ...styleTags]
  };

  try {
    const rawHistory = localStorage.getItem(HISTORY_KEY);
    const history = rawHistory ? JSON.parse(rawHistory) : [];
    history.unshift(newEntry);
    if (history.length > 50) history.pop(); 
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    const sbConfig = getSupabaseConfig();
    if (sbConfig) {
      MikirCloud.quiz.create(sbConfig, newEntry).catch(e => {
          console.error("Cloud Quiz Save Failed:", e);
          notifySupabaseError();
      });
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
  const payload = { ...quiz, fileName: quiz.fileName || quiz.file_name, topicSummary: quiz.topicSummary || quiz.topic_summary };
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

export const downloadFromCloud = async (cloudQuiz: any) => {
  try {
    let safeQuestions = cloudQuiz.questions;
    if (typeof safeQuestions === 'string') {
        try { safeQuestions = JSON.parse(safeQuestions); } catch (e) { safeQuestions = []; }
    }
    const localQuiz = { ...cloudQuiz, id: Date.now(), isCloud: false, questions: safeQuestions || [] };
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
