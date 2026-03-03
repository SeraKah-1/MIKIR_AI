
import { SRSItem } from "../types";
import { MikirCloud } from "./supabaseService";
import { getKeycardSession } from "./keycardService";
import { getSupabaseConfig } from "./storageService";

/**
 * NEURO-SYNC (SRS) SERVICE
 * Mengelola algoritma Spaced Repetition (SM-2 Modified)
 */

export const NeuroSync = {
  
  /**
   * Hitung jadwal review berikutnya menggunakan algoritma SM-2
   * @param item Item SRS saat ini
   * @param rating 0 (Again), 1 (Hard), 2 (Good), 3 (Easy)
   */
  calculateNextReview(item: SRSItem, rating: number): SRSItem {
    let { easiness, interval, repetition } = item;
    
    // Map rating 0-3 ke skala 0-5 SM-2
    // 0 -> 0 (Again)
    // 1 -> 2 (Hard)
    // 2 -> 4 (Good)
    // 3 -> 5 (Easy)
    const q = rating === 0 ? 0 : rating === 1 ? 2 : rating === 2 ? 4 : 5;

    if (q >= 3) {
      // Berhasil menjawab
      if (repetition === 0) {
        interval = 1;
      } else if (repetition === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easiness);
      }
      repetition++;
    } else {
      // Gagal / Lupa
      repetition = 0;
      interval = 0; // Immediate review (0 days)
    }

    // Update Easiness Factor
    easiness = easiness + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (easiness < 1.3) easiness = 1.3;

    const nextReview = new Date();
    // If interval is 0, set to now (or slightly in future to avoid immediate re-fetch issues if query uses > now)
    // But usually <= now is used for due items.
    nextReview.setDate(nextReview.getDate() + interval);
    
    // If interval is 0, ensure it is definitely "due" (e.g. set to now or 1 min ago)
    if (interval === 0) {
        nextReview.setMinutes(nextReview.getMinutes() - 1);
    }

    return {
      ...item,
      easiness,
      interval,
      repetition,
      next_review: nextReview.toISOString(),
      updated_at: new Date().toISOString()
    };
  },

  /**
   * Tambahkan item baru ke antrean SRS
   */
  async addItem(config: any, keycardId: string, item: Partial<SRSItem>) {
    const newItem: SRSItem = {
      keycard_id: keycardId,
      item_id: item.item_id!,
      item_type: item.item_type!,
      content: item.content,
      easiness: 2.5,
      interval: 0,
      repetition: 0,
      next_review: new Date().toISOString(),
      ...item
    };

    try {
      await MikirCloud.srs.upsert(config, newItem);
      return true;
    } catch (e) {
      console.error("Failed to add SRS item:", e);
      return false;
    }
  },

  /**
   * Ambil semua item yang siap di-review hari ini
   */
  async getDueItems(config: any, keycardId: string): Promise<SRSItem[]> {
    try {
      const data = await MikirCloud.srs.getDueItems(config, keycardId);
      return data as SRSItem[];
    } catch (e) {
      console.error("Failed to fetch due items:", e);
      return [];
    }
  },

  /**
   * Update item setelah di-review
   */
  async processReview(config: any, item: SRSItem, rating: number) {
    const updatedItem = this.calculateNextReview(item, rating);
    try {
      await MikirCloud.srs.upsert(config, updatedItem);
      return updatedItem;
    } catch (e) {
      console.error("Failed to update SRS item:", e);
      return null;
    }
  }
};

/**
 * LEGACY: Create a retention sequence by repeating some questions
 * @param questions Original questions
 * @param ratio Ratio of questions to repeat (0.6 = 60% more)
 */
export const createRetentionSequence = (questions: any[], ratio: number = 0.6): any[] => {
  if (!questions || questions.length === 0) return [];
  
  const repeatCount = Math.ceil(questions.length * ratio);
  const toRepeat = [...questions]
    .sort(() => Math.random() - 0.5)
    .slice(0, repeatCount)
    .map(q => ({ ...q, isReview: true, id: q.id + 1000 })); // Unique ID for review questions

  const combined = [...questions, ...toRepeat];
  return combined.sort(() => Math.random() - 0.5);
};

// --- COMPATIBILITY WRAPPERS ---

export const getDueItems = async (config?: any, keycardId?: string) => {
  const cfg = config || getSupabaseConfig();
  const kid = keycardId || getKeycardSession()?.id;
  if (!cfg || !kid) return [];
  return NeuroSync.getDueItems(cfg, kid);
};

export const processCardReview = async (config?: any, item?: SRSItem, rating?: number) => {
  const cfg = config || getSupabaseConfig();
  if (!cfg || !item || rating === undefined) return null;
  return NeuroSync.processReview(cfg, item, rating);
};

export const addQuestionToSRS = async (config?: any, keycardId?: string, question?: any) => {
  const cfg = config || getSupabaseConfig();
  const kid = keycardId || getKeycardSession()?.id;
  if (!cfg || !kid || !question) return false;
  
  return NeuroSync.addItem(cfg, kid, {
    item_id: `q_${question.id}`,
    item_type: 'quiz_question',
    content: question
  });
};

export const isSRSEnabled = () => {
  return localStorage.getItem('neuro_srs_enabled') !== 'false';
};

export const setSRSEnabled = (enabled: boolean) => {
  localStorage.setItem('neuro_srs_enabled', String(enabled));
};
