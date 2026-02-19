
/**
 * ==========================================
 * SRS SERVICE (Spaced Repetition System V2)
 * Algorithm: Modified SuperMemo-2 (SM-2)
 * Features: Fuzzing/Jitter, Ease Factor Decay, Session Retention
 * ==========================================
 */

import { Question, SRSData } from "../types";

const SRS_STORAGE_KEY = 'glassquiz_srs_data';
const SRS_SETTINGS_KEY = 'glassquiz_srs_enabled';

// --- UTILS ---

const hashString = (str: string): string => {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; 
  }
  return Math.abs(hash).toString(16);
};

// Add randomness to prevent cards bunching up on the same day
const applyFuzz = (interval: number) => {
    if (interval < 3) return interval;
    const fuzz = interval * 0.05; // 5% jitter
    const randomized = interval + (Math.random() * fuzz * 2) - fuzz;
    return Math.round(randomized);
};

export const setSRSEnabled = (enabled: boolean) => {
  localStorage.setItem(SRS_SETTINGS_KEY, JSON.stringify(enabled));
};

export const isSRSEnabled = (): boolean => {
  const val = localStorage.getItem(SRS_SETTINGS_KEY);
  return val ? JSON.parse(val) : true;
};

// --- DATA MANAGEMENT ---

export const getAllSRSItems = (): Record<string, SRSData> => {
  try {
    const raw = localStorage.getItem(SRS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
};

export const getDueItems = (): SRSData[] => {
  if (!isSRSEnabled()) return [];
  const allItems = getAllSRSItems();
  const now = Date.now();
  // Return items where dueDate is in the past
  return Object.values(allItems).filter(item => item.dueDate <= now);
};

export const addQuestionToSRS = (question: Question) => {
  if (!isSRSEnabled()) return;
  const id = hashString(question.text);
  const allItems = getAllSRSItems();

  if (!allItems[id]) {
    const newItem: SRSData = {
      id,
      question,
      interval: 0,
      repetition: 0,
      easeFactor: 2.5, // Standard SM-2 start
      dueDate: Date.now(),
      lastReviewed: 0
    };
    allItems[id] = newItem;
    localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(allItems));
  }
};

// --- SESSION RETENTION LOGIC (Sticky Quiz) ---
/**
 * Creates a sequence of questions where roughly X% are repeats of previous questions
 * to ensure "Sticky" retention during the session.
 * @param questions Original generated questions
 * @param retentionRatio Percentage of extra questions to add (e.g., 0.6 for 60% boost)
 */
export const createRetentionSequence = (questions: Question[], retentionRatio: number = 0.6): Question[] => {
  if (questions.length < 3) return questions;

  const finalSequence: Question[] = [];
  const pool = [...questions];
  const repeatsNeeded = Math.floor(questions.length * retentionRatio);
  
  // We use a "Deck" approach.
  // We deal original questions, and occasionally slip in a "Review" card from the "Seen Pile".
  
  let originalsDealt = 0;
  let repeatsInserted = 0;
  const seenIndices: number[] = [];

  // Helper to clone a question with a new unique ID for the session
  const createReviewClone = (q: Question): Question => ({
    ...q,
    id: q.id + 100000 + Math.floor(Math.random() * 90000), // New unique ID
    originalId: q.id,
    isReview: true,
    keyPoint: `[Review] ${q.keyPoint}`
  });

  // Start with 2-3 new questions to build initial context
  finalSequence.push(pool[0]); seenIndices.push(0); originalsDealt++;
  if(pool[1]) { finalSequence.push(pool[1]); seenIndices.push(1); originalsDealt++; }
  if(pool[2]) { finalSequence.push(pool[2]); seenIndices.push(2); originalsDealt++; }

  while (originalsDealt < pool.length || repeatsInserted < repeatsNeeded) {
    const shouldInsertRepeat = repeatsInserted < repeatsNeeded && seenIndices.length > 2 && Math.random() > 0.4;
    
    if (shouldInsertRepeat) {
      // Pick a question we've seen, but not the very last one (to avoid back-to-back same question)
      // Prefer ones seen a while ago (lower index in seenIndices)
      const eligibleIndices = seenIndices.slice(0, seenIndices.length - 2); 
      if (eligibleIndices.length > 0) {
         const randomSeenIdx = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
         const originalQ = pool[randomSeenIdx];
         finalSequence.push(createReviewClone(originalQ));
         repeatsInserted++;
      } else if (originalsDealt < pool.length) {
         finalSequence.push(pool[originalsDealt]);
         seenIndices.push(originalsDealt);
         originalsDealt++;
      }
    } else {
      // Deal new question
      if (originalsDealt < pool.length) {
        finalSequence.push(pool[originalsDealt]);
        seenIndices.push(originalsDealt);
        originalsDealt++;
      } else {
        // If no originals left but we still need repeats
        const eligibleIndices = seenIndices.slice(0, seenIndices.length - 2);
        if (eligibleIndices.length > 0) {
           const randomSeenIdx = eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)];
           finalSequence.push(createReviewClone(pool[randomSeenIdx]));
           repeatsInserted++;
        } else {
           break; // Safety break
        }
      }
    }
  }

  return finalSequence;
};

// --- CORE ALGORITHM ---

export const processCardReview = (question: Question, quality: number) => {
  // Quality Input:
  // 1 = Lupa (Fail)
  // 3 = Ragu (Hard Pass)
  // 5 = Paham (Easy Pass)

  const id = hashString(question.text);
  const allItems = getAllSRSItems();
  let item = allItems[id];

  if (!item) {
    // Should not happen, but safe fallback
    item = { id, question, interval: 0, repetition: 0, easeFactor: 2.5, dueDate: Date.now(), lastReviewed: 0 };
  }

  let { interval, repetition, easeFactor } = item;

  if (quality >= 3) {
    // --- SUCCESS PATH ---
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = (quality === 5) ? 4 : 3; // Boost early progress if easy
    } else {
      let bonus = (quality === 5) ? 1.3 : 1.0; // Easy bonus
      interval = Math.round(interval * easeFactor * bonus);
    }
    repetition += 1;
  } else {
    // --- FAILURE PATH ---
    repetition = 0;
    interval = 1; // Reset to 1 day
  }

  // --- EASE FACTOR CALCULATION (Standard SM-2) ---
  // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  // If quality is 5, EF increases slightly.
  // If quality is 3, EF drops.
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // Floor EF at 1.3 to prevent getting stuck in "hell"
  if (easeFactor < 1.3) easeFactor = 1.3;

  const fuzzedInterval = applyFuzz(interval);
  const now = Date.now();
  const nextDueDate = now + (fuzzedInterval * 24 * 60 * 60 * 1000);

  const updatedItem: SRSData = {
    ...item,
    interval: fuzzedInterval,
    repetition,
    easeFactor,
    dueDate: nextDueDate,
    lastReviewed: now
  };

  allItems[id] = updatedItem;
  localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(allItems));

  return updatedItem;
};
