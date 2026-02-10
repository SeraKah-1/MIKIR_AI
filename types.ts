
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
  VIRTUAL_ROOM = 'VIRTUAL_ROOM' // New View
}

export enum QuizMode {
  STANDARD = 'STANDARD',
  SCAFFOLDING = 'SCAFFOLDING', // Easy -> Hard (Guided)
  TIME_RUSH = 'TIME_RUSH',     // Timer per question
  SURVIVAL = 'SURVIVAL'        // 3 Lives only
}

export enum ExamStyle {
  CONCEPTUAL = 'CONCEPTUAL',   // Hafalan, Definisi (C1-C2)
  ANALYTICAL = 'ANALYTICAL',   // Logika, Sebab-Akibat (C4-C5)
  CASE_STUDY = 'CASE_STUDY',   // Penerapan Situasi (C3)
  COMPETITIVE = 'COMPETITIVE'  // Detail, Jebakan, Hard (Olympiad style)
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

export interface QuizResult {
  correctCount: number;
  totalQuestions: number;
  score: number;
  mode: QuizMode;
  answers: { questionId: number; selectedIndex: number; isCorrect: boolean }[];
}

export interface SkillAnalysis {
  memory: number; // 0-100
  logic: number;
  focus: number;
  application: number;
  analysis: string; // Text summary
}

export type AiProvider = 'gemini' | 'groq';
export type StorageProvider = 'local' | 'supabase';

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
  isVision?: boolean; // To know if it supports file upload natively
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
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B", provider: 'groq' },
  
  // --- GROQ PREVIEW MODELS ---
  { id: "meta-llama/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick 17B (Preview)", provider: 'groq' },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B (Preview)", provider: 'groq' },
  { id: "moonshotai/kimi-k2-instruct-0905", label: "Kimi K2 Instruct", provider: 'groq' },
  { id: "qwen/qwen3-32b", label: "Qwen 3 32B", provider: 'groq' },
];
