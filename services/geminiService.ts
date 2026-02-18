
/**
 * ==========================================
 * GEMINI AI SERVICE (SMART CACHING ARCHITECTURE)
 * ==========================================
 */

import { GoogleGenAI } from "@google/genai";
import { Question, QuizMode, ExamStyle } from "../types";

// --- CONFIGURATION ---

// Prioritas Model untuk Ingestion (Meringkas). 
const INGESTION_MODELS = [
  'gemini-3-pro-preview',     // 1. Frontier Intelligence
  'gemini-2.5-pro',           // 2. Stable Advanced Thinking
  'gemini-3-flash-preview',   // 3. Balanced Speed
  'gemini-2.5-flash',         // 4. Stable Fast
  'gemini-2.5-flash-lite'     // 5. Ultra Fast Fallback
];

// Model Cepat untuk "Generation" (Membuat Soal) -> High RPM
const DEFAULT_GENERATION_MODEL = 'gemini-3-flash-preview';

const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } } | { text: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // Simple text files
    if (file.type === "text/markdown" || file.type === "text/plain" || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      reader.onloadend = () => resolve({ text: reader.result as string });
      reader.readAsText(file);
    } else {
      // PDF / Images
      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type || 'application/pdf',
          },
        });
      };
      reader.readAsDataURL(file);
    }
    reader.onerror = reject;
  });
};

const cleanAndParseJSON = (rawText: string): any[] => {
  // 1. Remove <thinking> tags (Crucial for Gemini 2.0/3.0 Thinking models)
  let text = rawText.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();

  // 2. Cleanup Markdown
  text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  // 3. Isolate the JSON Array
  const firstOpen = text.indexOf('[');
  let lastClose = text.lastIndexOf(']');

  // 4. Fallback: If no array found, check if it's wrapped in an object
  if (firstOpen === -1) {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
          try {
              const potentialObj = JSON.parse(text.substring(firstBrace, lastBrace + 1));
              for (const key in potentialObj) {
                  if (Array.isArray(potentialObj[key])) return potentialObj[key];
              }
          } catch(e) { /* ignore */ }
      }
      throw new Error("Format JSON invalid (Tidak ditemukan Array '[').");
  }

  // 5. Robust Truncation Fix: If ']' is missing, assume truncation
  let jsonContent = "";
  if (lastClose === -1 || lastClose < firstOpen) {
      // Try to artificially close it
      jsonContent = text.substring(firstOpen);
      // Remove trailing comma if exists
      if (jsonContent.trim().endsWith(',')) jsonContent = jsonContent.trim().slice(0, -1);
      // Append close bracket
      jsonContent += ']';
  } else {
      jsonContent = text.substring(firstOpen, lastClose + 1);
  }

  try {
    return JSON.parse(jsonContent);
  } catch (e) {
    // 6. Last Resort Repair: Remove trailing commas
    try {
        const fixedContent = jsonContent.replace(/,\s*([\]}])/g, '$1');
        return JSON.parse(fixedContent);
    } catch (e2) {
        console.error("JSON Parse Fail. Raw:", rawText);
        throw new Error("Gagal parsing output AI. Struktur JSON rusak.");
    }
  }
};

const sanitizeQuestion = (q: any): Omit<Question, 'id'> => {
  let options = Array.isArray(q.options) ? q.options : ["A", "B", "C", "D"];
  options = options.map((o: any) => String(o)).slice(0, 4);
  while (options.length < 4) options.push(`Opsi ${options.length + 1}`);

  let correctIndex = Number(q.correctIndex);
  if (isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) correctIndex = 0;

  // Shuffle options
  const correctAnswerText = options[correctIndex];
  for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
  }
  const newCorrectIndex = options.indexOf(correctAnswerText);

  return {
    text: String(q.text || "Soal Kosong"),
    options: options,
    correctIndex: newCorrectIndex,
    explanation: String(q.explanation || "Pembahasan tidak tersedia."),
    keyPoint: String(q.keyPoint || "Umum").substring(0, 20),
    difficulty: "Medium"
  };
};

/**
 * SMART INGESTION (HEAVY LIFTING)
 * Menggunakan Loop Fallback. Jika model Pro Experimental gagal, coba model stabil.
 */
export const summarizeMaterial = async (apiKey: string, content: string): Promise<string> => {
  if (!content) return "";
  
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
    ROLE: Senior Knowledge Engineer.
    TASK: Process the provided raw document into a "High-Density Knowledge Summary" optimized for future RAG (Retrieval Augmented Generation).
    
    INSTRUCTIONS:
    1. READ the entire raw text.
    2. EXTRACT every single definition, date, formula, key figure, and cause-effect relationship.
    3. DISCARD fluff, introductions, filler words, and repetitive examples.
    4. FORMAT the output as a structured list of facts and concepts.
    
    OUTPUT FORMAT (Plain Text):
    [Topic Name]
    - Concept A: Definition...
    - Fact B: Date/Value...
    - Relation C: A causes B because...
    
    RAW TEXT (Truncated for safety):
    "${content.substring(0, 200000)}" 
  `;

  // --- RETRY LOGIC WITH MULTIPLE MODELS ---
  for (const modelName of INGESTION_MODELS) {
    try {
      console.log(`[Smart Ingest] Trying model: ${modelName}...`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts: [{ text: prompt }] }
      });
      
      const result = response.text;
      if (!result) throw new Error("Empty response");
      
      return `[SMART CACHE - ${modelName}]\n${result}`;
    } catch (e: any) {
      console.warn(`[Smart Ingest] Model ${modelName} failed:`, e.message);
      // Continue to next model in loop
    }
  }

  console.error("[Smart Ingest] All models failed. Falling back to raw text.");
  return content.substring(0, 5000); // Ultimate Fallback if AI is completely dead
};

/**
 * QUIZ GENERATION (FAST EXECUTION)
 * Menggunakan Model Flash (default) untuk membuat soal dari Context yang sudah bersih.
 */
export const generateQuiz = async (
  apiKey: string, 
  files: File[] | File | null, 
  topic: string | undefined, 
  modelId: string, // User selected model
  questionCount: number,
  mode: QuizMode,
  examStyle: ExamStyle = ExamStyle.CONCEPTUAL,
  onProgress: (status: string) => void,
  existingQuestionsContext: string[] = [],
  customPrompt: string = "",
  libraryContext: string = "" 
): Promise<{ questions: Question[], contextText: string }> => {
  
  if (!apiKey) throw new Error("API Key Gemini belum diatur.");
  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  const parts: any[] = [];
  let contextText = ""; 

  // 1. Handle Library Context (Ini adalah Smart Cache dari Supabase/Local)
  if (libraryContext) {
     onProgress("Memuat Smart Cache (Hemat Token)...");
     // Kirim konteks yang sudah diringkas. Flash model sangat cepat memproses ini.
     parts.push({ text: `KNOWLEDGE BASE (SUMMARY):\n${libraryContext.substring(0, 100000)}` }); 
     contextText = "[Library Source]";
  }

  // 2. Handle File Uploads (Binary/Text)
  const fileArray = Array.isArray(files) ? files : (files ? [files] : []);
  if (fileArray.length > 0) {
    onProgress(`Memproses ${fileArray.length} File Tambahan...`);
    for (const file of fileArray) {
       const filePart = await fileToGenerativePart(file);
       parts.push(filePart);
    }
    contextText += ` [Files: ${fileArray.map(f => f.name).join(', ')}]`; 
  } 
  
  // 3. Topic Focus
  if (topic) {
    parts.push({ text: `IMPORTANT: FOCUS ONLY ON THIS TOPIC: "${topic}". Ignore unrelated parts.` });
  }

  let avoidancePrompt = "";
  if (existingQuestionsContext.length > 0) {
      const prevTopics = existingQuestionsContext.map(q => q.substring(0, 20)).slice(-20).join(", ");
      avoidancePrompt = `DO NOT repeat these questions: [${prevTopics}].`;
  }

  // Optimized Prompt for JSON Stability
  const finalPrompt = `
    ROLE: Strict Academic Examiner.
    TASK: Create EXACTLY ${questionCount} multiple-choice questions in INDONESIAN.
    
    INSTRUCTIONS:
    1. USE the provided Knowledge Base.
    2. GENERATE ${questionCount} valid JSON objects.
    3. Difficulty: ${examStyle}.
    4. FOCUS: "${topic || 'General Material'}".
    
    USER NOTE: "${customPrompt}"

    OUTPUT FORMAT (Strict JSON Array):
    [
      {
        "text": "Question?",
        "options": ["A", "B", "C", "D"],
        "correctIndex": 0,
        "explanation": "Why correct.",
        "keyPoint": "Tag"
      }
    ]
    ${avoidancePrompt}
  `;

  parts.push({ text: finalPrompt });

  const selectedModel = modelId || DEFAULT_GENERATION_MODEL;
  onProgress(`Menyusun ${questionCount} soal dengan ${selectedModel}...`);
  
  // --- GENERATION RETRY LOGIC (Simple 1-level fallback) ---
  const tryGenerate = async (model: string) => {
      const response = await ai.models.generateContent({
        model: model,
        contents: { parts },
        config: { 
          responseMimeType: "application/json", 
          temperature: 0.3, 
          maxOutputTokens: 8192, 
        }
      });
      return response;
  };

  try {
      let response;
      try {
         response = await tryGenerate(selectedModel);
      } catch (err: any) {
         if (err.message.includes("404") || err.message.includes("not found")) {
             console.warn(`Model ${selectedModel} not found, falling back to stable.`);
             onProgress("Model Experimental sibuk/404, menggunakan model Stabil...");
             response = await tryGenerate("gemini-2.5-flash");
         } else {
             throw err;
         }
      }

      const responseText = response.text;
      if (!responseText) throw new Error("AI Empty Response");

      onProgress("Memvalidasi Soal...");
      const rawQuestions = cleanAndParseJSON(responseText);

      if (!Array.isArray(rawQuestions)) throw new Error("Format AI salah (Bukan Array).");
      
      const validQuestions = rawQuestions.filter(q => q.text && !q.text.includes("ERROR") && q.options && q.options.length > 1);

      if (validQuestions.length < 2) {
         throw new Error("AI gagal generate cukup soal. Coba kurangi materi atau spesifikkan topik.");
      }

      const finalQuestions = validQuestions.map((q, index) => ({
        ...sanitizeQuestion(q),
        id: index + 1
      }));

      return { questions: finalQuestions, contextText };

  } catch (err: any) {
      console.error("Gemini Error:", err);
      if (err.message.includes("404") || err.message.includes("not found")) {
         throw new Error(`Model ${modelId} tidak tersedia. Coba ganti model di Settings.`);
      }
      if (err.message.includes("429")) throw new Error("Server sibuk (Rate Limit). Tunggu sebentar.");
      
      throw err;
  }
};

export const chatWithDocument = async (apiKey: string, modelId: string, history: any[], message: string, contextText: string, file: File | null) => {
  return "Fitur chat sedang dalam perbaikan."; 
};
