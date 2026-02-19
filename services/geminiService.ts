
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

  // 3. Robust Extraction Strategy for Library Context
  // Sometimes AI adds text BEFORE the JSON array like "Based on the provided library... here is the JSON: ["
  const firstOpen = text.indexOf('[');
  let lastClose = text.lastIndexOf(']');

  // 4. Fallback: If no array found, check if it's wrapped in an object or just garbage text
  if (firstOpen === -1) {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
          try {
              const potentialObj = JSON.parse(text.substring(firstBrace, lastBrace + 1));
              // Try to find an array value inside the object
              for (const key in potentialObj) {
                  if (Array.isArray(potentialObj[key])) return potentialObj[key];
              }
              // If the object itself is a single question (rare), wrap it
              if (potentialObj.text && potentialObj.options) return [potentialObj];
          } catch(e) { /* ignore */ }
      }
      throw new Error("Format JSON invalid (Tidak ditemukan Array '['). AI mungkin menolak topik.");
  }

  // 5. Robust Truncation Fix: If ']' is missing, assume truncation
  let jsonContent = "";
  if (lastClose === -1 || lastClose < firstOpen) {
      // The output is likely truncated.
      const contentSoFar = text.substring(firstOpen);
      
      // Attempt 1: Find the last "}," which signifies the end of a complete object in a list.
      const lastCommaBrace = contentSoFar.lastIndexOf('},');
      
      if (lastCommaBrace !== -1) {
          // Cut off everything after the last complete object and close the array.
          jsonContent = contentSoFar.substring(0, lastCommaBrace + 1) + ']';
      } else {
          // Attempt 2: Maybe only one object exists and it's complete, just missing the array close?
          const lastBrace = contentSoFar.lastIndexOf('}');
          if (lastBrace !== -1) {
              jsonContent = contentSoFar.substring(0, lastBrace + 1) + ']';
          } else {
              // Attempt 3: No complete objects found. Return empty to trigger retry logic upstream if needed.
              console.warn("JSON Truncated with no complete objects found.");
              return [];
          }
      }
  } else {
      jsonContent = text.substring(firstOpen, lastClose + 1);
  }

  try {
    return JSON.parse(jsonContent);
  } catch (e) {
    // 6. Last Resort Repair: Remove trailing commas (e.g. [ {...}, ] )
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

  // Note: We do NOT shuffle options here anymore because the AI prompt explicitly designs 
  // Distractors (B, C, D) based on misconceptions. If we shuffle, the "Analysis" in feedback 
  // might mismatch the position.
  // HOWEVER, current app logic relies on `correctIndex`.
  // To keep "Diagnostic Distractors" working, we assume AI output is [Correct, Distractor1, Distractor2, Distractor3]
  // We will shuffle them but update the correctIndex accordingly.
  
  const originalCorrectText = options[correctIndex]; // Usually index 0 from AI prompt instruction
  
  // Fisher-Yates Shuffle
  for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
  }
  
  const newCorrectIndex = options.indexOf(originalCorrectText);

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
 * Implements "Retrieval Practice" & "Elaborative Feedback"
 */
export const generateQuiz = async (
  apiKey: string, 
  files: File[] | File | null, 
  topic: string | undefined, 
  modelId: string, // User selected model
  questionCount: number,
  mode: QuizMode,
  examStyles: ExamStyle[] = [ExamStyle.C2_CONCEPT], // Bloom's Taxonomy Array
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
     // Clearly separate Library content
     parts.push({ text: `LIBRARY MATERIAL:\n${libraryContext.substring(0, 100000)}\n\nEND OF LIBRARY MATERIAL` }); 
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

  const bloomInstruction = examStyles.length > 0 
    ? `COGNITIVE LEVELS (Mix these types): ${examStyles.join(', ')}`
    : `COGNITIVE LEVEL: ${ExamStyle.C2_CONCEPT}`;

  // --- PROMPT ENGINEERING: LEARNING BY DOING ---
  const finalPrompt = `
    ROLE: Expert Tutor using "Socratic Method" and "Retrieval Practice".
    
    GOAL: Create an interactive quiz for the topic: "${topic || 'General Material from Context'}".
    OBJECTIVE: To teach concepts THROUGH questions (Learning by Doing), not just test memory.
    
    ${bloomInstruction}
    USER CUSTOM INSTRUCTION: "${customPrompt}"

    INSTRUCTIONS:
    1. GENERATE EXACTLY ${questionCount} valid JSON objects.
    2. USE the provided Knowledge Base (Library/Files). If Library is provided, STRICTLY adhere to it.
    3. STRUCTURE each question with "Diagnostic Distractors".
       - Option A: Correct Answer.
       - Option B: Wrong (Definition Mix-up).
       - Option C: Wrong (Calculation/Logic Error).
       - Option D: Wrong (Common Misconception).
    4. ELABORATIVE FEEDBACK (Crucial):
       In the 'explanation' field, do NOT just say "B is correct".
       You MUST use this Markdown format:
       "**Jawaban Benar:** [Concept explanation]
        
        **Analisis Miskonsepsi:**
        - [Why distractor 1 is wrong]
        - [Why distractor 2 is wrong]"

    OUTPUT FORMAT (Strict JSON Array, NO intro text, NO markdown formatting outside the JSON):
    [
      {
        "text": "Scenario/Question matching Bloom levels?",
        "options": ["Correct Answer", "Distractor 1", "Distractor 2", "Distractor 3"],
        "correctIndex": 0,
        "explanation": "**Jawaban Benar:** ... \n\n **Analisis Miskonsepsi:** ...",
        "keyPoint": "Tag (Concept)"
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
          temperature: 0.4, // Slightly higher for creative distractors
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
