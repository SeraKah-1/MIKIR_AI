
export enum QuizState {
  CONFIG = 'CONFIG',
  PROCESSING = 'PROCESSING',
  QUIZ_ACTIVE = 'QUIZ_ACTIVE',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR',
  CHALLENGE_LANDING = 'CHALLENGE_LANDING' // New State
}

export enum AppView {
  GENERATOR = 'GENERATOR',
  WORKSPACE = 'WORKSPACE', 
  SETTINGS = 'SETTINGS',
  VIRTUAL_ROOM = 'VIRTUAL_ROOM'
}

export enum QuizMode {
  STANDARD = 'STANDARD',
  SCAFFOLDING = 'SCAFFOLDING', 
  TIME_RUSH = 'TIME_RUSH',     
  SURVIVAL = 'SURVIVAL',
  CHALLENGE = 'CHALLENGE' // New Mode
}

export enum ExamStyle {
  CONCEPTUAL = 'CONCEPTUAL',   
  ANALYTICAL = 'ANALYTICAL',   
  CASE_STUDY = 'CASE_STUDY',   
  COMPETITIVE = 'COMPETITIVE'  
}

// --- NEW QUESTION TYPES ---
export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_BLANK';

export interface Question {
  id: number;
  type?: QuestionType; // Defaults to MULTIPLE_CHOICE
  text: string;
  options: string[]; 
  correctIndex: number; 
  correctAnswer?: string; // For FillBlank (String matching)
  proposedAnswer?: string; // NEW: For True/False (e.g. "Apakah ibukota Jabar adalah [Surabaya]?")
  explanation: string;
  keyPoint: string; 
  difficulty: 'Easy' | 'Medium' | 'Hard';
  isReview?: boolean;
  originalId?: number;
}

export interface SRSData {
  id: string; 
  question: Question;
  interval: number; 
  repetition: number; 
  easeFactor: number; 
  dueDate: number; 
  lastReviewed: number; 
}

export interface QuizResult {
  correctCount: number;
  totalQuestions: number;
  score: number;
  mode: QuizMode;
  answers: { questionId: number; selectedIndex: number; textAnswer?: string; isCorrect: boolean }[];
  challengeId?: string; // Link to challenge if applicable
}

export interface ChallengeData {
  id: string;
  creatorName: string;
  topic: string;
  questions: Question[];
  creatorScore: number;
  challengerName?: string;
  challengerScore?: number;
  created_at: string;
}

export interface SkillAnalysis {
  memory: number; 
  logic: number;
  focus: number;
  application: number;
  analysis: string; 
}

export interface LibraryItem {
  id: string | number;
  title: string;
  content: string; 
  processedContent?: string; // NEW: Cached summary/notes from AI
  type: 'pdf' | 'text' | 'note';
  tags: string[];
  created_at: string;
}

export interface CloudNote {
  id: string | number; 
  title: string;       
  content: string;
  created_at: string;  
  tags?: string[];     
}

export type AiProvider = 'gemini' | 'groq';
export type StorageProvider = 'local' | 'supabase';

export interface KeycardData {
  version: string;
  metadata: {
    owner: string;
    created_at: number;
    expires_at?: number;
    valid_domain?: string;
  };
  config: {
    geminiKey?: string; 
    geminiKeys?: string[]; 
    groqKey?: string; 
    groqKeys?: string[]; 
    preferredProvider?: AiProvider;
    supabaseUrl?: string;
    supabaseKey?: string;
    customPrompt?: string; 
  };
}

export interface ModelConfig {
  provider: AiProvider;
  modelId: string;
  questionCount: number;
  mode: QuizMode;
  examStyle: ExamStyle;
  topic?: string; 
  customPrompt?: string; 
  libraryContext?: string;
  enableRetention?: boolean;
  enableMixedTypes?: boolean; // New: Toggle for True/False & FillBlank
}

export interface ModelOption {
  id: string;
  label: string;
  provider: AiProvider;
  isVision?: boolean; 
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // --- GEMINI 3 SERIES (Frontier Intelligence) ---
  { id: "gemini-3-pro-preview", label: "Gemini 3 Pro (Most Intelligent)", provider: 'gemini', isVision: true },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash (Balanced Speed)", provider: 'gemini', isVision: true },

  // --- GEMINI 2.5 SERIES (Stable & Thinking) ---
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Advanced Thinking)", provider: 'gemini', isVision: true },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Fast & Intelligent)", provider: 'gemini', isVision: true },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite (Ultra Fast)", provider: 'gemini', isVision: true },

  // --- LEGACY / BACKUP ---
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Deprecated)", provider: 'gemini', isVision: true },
  
  // --- GROQ MODELS ---
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Versatile)", provider: 'groq' },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B (Instant)", provider: 'groq' },
  { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", provider: 'groq' },
];
