
export enum QuizState {
  CONFIG = 'CONFIG',
  PROCESSING = 'PROCESSING',
  QUIZ_ACTIVE = 'QUIZ_ACTIVE',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR'
}

export enum AppView {
  GENERATOR = 'GENERATOR',
  HISTORY = 'HISTORY',
  SETTINGS = 'SETTINGS',
  VIRTUAL_ROOM = 'VIRTUAL_ROOM'
}

export enum QuizMode {
  STANDARD = 'STANDARD',
  SCAFFOLDING = 'SCAFFOLDING', 
  TIME_RUSH = 'TIME_RUSH',     
  SURVIVAL = 'SURVIVAL'        
}

export enum ExamStyle {
  CONCEPTUAL = 'CONCEPTUAL',   
  ANALYTICAL = 'ANALYTICAL',   
  CASE_STUDY = 'CASE_STUDY',   
  COMPETITIVE = 'COMPETITIVE'  
}

export interface Question {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  keyPoint: string; 
  difficulty: 'Easy' | 'Medium' | 'Hard';
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
  answers: { questionId: number; selectedIndex: number; isCorrect: boolean }[];
}

export interface SkillAnalysis {
  memory: number; 
  logic: number;
  focus: number;
  application: number;
  analysis: string; 
}

export interface CloudNote {
  id: string | number; // Updated to support UUID/Text IDs from neuro_notes
  title: string;       // Mapped from 'topic'
  content: string;
  created_at: string;  // Mapped from 'timestamp'
  tags?: string[];     // Mapped from 'mode' + 'provider'
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
    groqKey?: string;
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
}

export interface ModelOption {
  id: string;
  label: string;
  provider: AiProvider;
  isVision?: boolean; 
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // --- GOOGLE GEMINI MODELS ---
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Standard)", provider: 'gemini', isVision: true },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (Fastest)", provider: 'gemini', isVision: true },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash (High IQ)", provider: 'gemini', isVision: true },
  { id: "gemma-3-27b-it", label: "Gemma 3 27B (Deep Reasoning)", provider: 'gemini', isVision: true },
  
  // --- GROQ PRODUCTION MODELS ---
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Versatile)", provider: 'groq' },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B (Instant)", provider: 'groq' },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B (Flagship)", provider: 'groq' },
  
  // --- GROQ PREVIEW MODELS ---
  { id: "meta-llama/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick 17B (Preview)", provider: 'groq' },
];
