
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
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Fast & Smart)", provider: 'gemini', isVision: true },
  { id: "gemini-2.0-flash-lite-preview-02-05", label: "Gemini 2.0 Flash Lite (Super Fast)", provider: 'gemini', isVision: true },
  { id: "gemini-2.0-pro-exp-02-05", label: "Gemini 2.0 Pro (Reasoning)", provider: 'gemini', isVision: true },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Legacy Stable)", provider: 'gemini', isVision: true },
  { id: "gemma-2-27b-it", label: "Gemma 2 27B (Open Model)", provider: 'gemini' },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Versatile)", provider: 'groq' },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B (Instant)", provider: 'groq' },
  { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", provider: 'groq' },
  { id: "gemma2-9b-it", label: "Gemma 2 9B (Groq)", provider: 'groq' },
];
