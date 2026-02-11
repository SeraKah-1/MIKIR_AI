
/**
 * ==========================================
 * SRS SERVICE (Spaced Repetition System)
 * Implementation of SM-2 Algorithm
 * ==========================================
 */

import { Question, SRSData } from "../types";

const SRS_STORAGE_KEY = 'glassquiz_srs_data';
const SRS_SETTINGS_KEY = 'glassquiz_srs_enabled';

// --- UTILS ---

// Create a simple hash from string to use as ID
const hashString = (str: string): string => {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
};

// --- SETTINGS ---

export const setSRSEnabled = (enabled: boolean) => {
  localStorage.setItem(SRS_SETTINGS_KEY, JSON.stringify(enabled));
};

export const isSRSEnabled = (): boolean => {
  const val = localStorage.getItem(SRS_SETTINGS_KEY);
  return val ? JSON.parse(val) : true; // Default to true
};

// --- DATA MANAGEMENT ---

export const getAllSRSItems = (): Record<string, SRSData> => {
  try {
    const raw = localStorage.getItem(SRS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

export const getDueItems = (): SRSData[] => {
  if (!isSRSEnabled()) return [];

  const allItems = getAllSRSItems();
  const now = Date.now();
  
  return Object.values(allItems).filter(item => {
    return item.dueDate <= now;
  });
};

export const addQuestionToSRS = (question: Question) => {
  if (!isSRSEnabled()) return;

  const id = hashString(question.text);
  const allItems = getAllSRSItems();

  // Only add if not exists
  if (!allItems[id]) {
    const newItem: SRSData = {
      id,
      question,
      interval: 0,
      repetition: 0,
      easeFactor: 2.5,
      dueDate: Date.now(), // Due immediately
      lastReviewed: 0
    };
    allItems[id] = newItem;
    localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(allItems));
  }
};

// --- ALGORITHM (SuperMemo-2) ---

export const processCardReview = (question: Question, quality: number) => {
  // Quality: 0-5 (we map UI buttons: Hard=3, Good=4, Easy=5)
  // Hard (Again) actually resets in many Anki styles, but for simplicity:
  // 3 = Hard (Pass), 4 = Good, 5 = Easy
  
  const id = hashString(question.text);
  const allItems = getAllSRSItems();
  let item = allItems[id];

  // If item doesn't exist (e.g. from a new quiz), init it
  if (!item) {
    item = {
      id,
      question,
      interval: 0,
      repetition: 0,
      easeFactor: 2.5,
      dueDate: Date.now(),
      lastReviewed: 0
    };
  }

  // SM-2 Logic
  let { interval, repetition, easeFactor } = item;

  if (quality >= 3) {
    // Correct response
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetition += 1;
  } else {
    // Incorrect response (Reset)
    repetition = 0;
    interval = 1;
  }

  // Update Ease Factor
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  // Calculate Dates
  const now = Date.now();
  const nextDueDate = now + (interval * 24 * 60 * 60 * 1000);

  // Save
  const updatedItem: SRSData = {
    ...item,
    interval,
    repetition,
    easeFactor,
    dueDate: nextDueDate,
    lastReviewed: now
  };

  allItems[id] = updatedItem;
  localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(allItems));

  return updatedItem;
};

export const getNextReviewText = (days: number): string => {
  if (days <= 0) return "Hari ini";
  if (days === 1) return "Besok";
  return `${days} hari`;
};
