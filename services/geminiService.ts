
/**
 * ==========================================
 * GEMINI AI SERVICE (BATCHED & PARALLEL)
 * ==========================================
 */

import { GoogleGenAI } from "@google/genai";
import { Question, QuizMode, ExamStyle } from "../types";

const BATCH_SIZE = 20; // Gemini handles larger context better than Groq

// Helper to convert file to base64
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } } | { text: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    if (file.type === "text/markdown" || file.type === "text/plain" || file.name.endsWith('.md')) {
      reader.onloadend = () => {
        resolve({ text: reader.result as string });
      };
      reader.readAsText(file);
    } else {
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

// ROBUST JSON CLEANER
const cleanJSON = (text: string) => {
  let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  }
  return cleaned;
};

const sanitizeQuestion = (q: any): Omit<Question, 'id'> => {
  let options = q.options || [];

  if (typeof options === 'string') {
    options = options.split(',').map((o: string) => o.trim());
  } else if (Array.isArray(options)) {
    options = options.map((o: any) => {
      if (typeof o === 'object' && o !== null) {
        return o.text || o.value || o.label || JSON.stringify(o);
      }
      return String(o);
    });
  } else {
    options = ["Option A", "Option B", "Option C", "Option D"];
  }

  while (options.length < 4) options.push(`Option ${options.length + 1}`);
  options = options.slice(0, 4);

  let correctIndex = Number(q.correctIndex);
  if (isNaN(correctIndex)) {
     if (typeof q.correctIndex === 'string' && q.correctIndex.length === 1) {
        const charCode = q.correctIndex.toUpperCase().charCodeAt(0);
        if (charCode >= 65 && charCode <= 68) correctIndex = charCode - 65; 
     } else {
        correctIndex = 0; 
     }
  }
  if (correctIndex >= 4) correctIndex = 0;
  if (correctIndex < 0) correctIndex = 0;

  // --- SHUFFLE LOGIC (NEW) ---
  // AI tends to put correct answer at index 0. We randomize strictly here.
  const correctContent = options[correctIndex];
  
  // Fisher-Yates Shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  // Find where the correct answer moved to
  const newCorrectIndex = options.indexOf(correctContent);

  return {
    text: String(q.text || "Pertanyaan kosong (Error AI)"),
    options: options,
    correctIndex: newCorrectIndex !== -1 ? newCorrectIndex : 0, // Fallback safe
    explanation: String(q.explanation || "Tidak ada penjelasan."),
    keyPoint: String(q.keyPoint || "Topik Umum"),
    difficulty: (["Easy", "Medium", "Hard"].includes(q.difficulty) ? q.difficulty : "Medium") as any
  };
};

export const generateQuiz = async (
  apiKey: string, 
  file: File | null, 
  topic: string | undefined, 
  modelId: string,
  questionCount: number,
  mode: QuizMode,
  examStyle: ExamStyle = ExamStyle.CONCEPTUAL,
  onProgress: (status: string) => void,
  existingQuestionsContext: string[] = [] // NEW: List of existing question texts to avoid
): Promise<{ questions: Question[], contextText: string }> => {
  
  if (!apiKey) throw new Error("API Key belum diatur. Silakan ke menu Settings.");

  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  // Handle File Input if present
  let filePart = null;
  let contextText = ""; 

  if (file) {
    filePart = await fileToGenerativePart(file);
    if ('text' in filePart) {
      contextText = filePart.text;
    } else {
      contextText = `[Binary File: ${file.name}]`; 
    }
  } else if (topic) {
    contextText = topic;
  }

  const totalBatches = Math.ceil(questionCount / BATCH_SIZE);
  
  onProgress(`Menyiapkan ${totalBatches} workers...`);

  let completedBatches = 0;

  // PROMPT CONSTRUCTION
  let stylePrompt = "";
  switch (examStyle) {
    case ExamStyle.CONCEPTUAL: 
      stylePrompt = `
        STYLE: ESSENTIALIST & DEEP.
        - Questions must be concise (under 20 words).
        - Focus on "First Principles" (Why/How).
        - Test misconceptions.
      `; 
      break;
    case ExamStyle.ANALYTICAL: 
      stylePrompt = `STYLE: LOGIC PUZZLE. Connect two distinct concepts from the text. Questions requiring inference.`; 
      break;
    case ExamStyle.CASE_STUDY: 
      stylePrompt = `STYLE: SCENARIO. Short practical situation (2 sentences max). Application of theory.`; 
      break;
    case ExamStyle.COMPETITIVE: 
      stylePrompt = `STYLE: TRICKY & PRECISE. Use distractors that are partially true but technically wrong.`; 
      break;
    default: 
      stylePrompt = `STYLE: ACADEMIC.`; 
      break;
  }

  let duplicateGuard = "";
  if (existingQuestionsContext.length > 0) {
    const snippet = existingQuestionsContext.slice(-25).join(" | ");
    duplicateGuard = `IGNORE previously generated concepts: [${snippet}]. Explore NEW angles.`;
  }

  const batchPromises = Array.from({ length: totalBatches }).map(async (_, i) => {
    const currentBatchNum = i + 1;
    const isLastBatch = i === totalBatches - 1;
    const questionsForThisBatch = isLastBatch 
      ? questionCount - (i * BATCH_SIZE) 
      : BATCH_SIZE;

    // Skip empty batch if math is off
    if (questionsForThisBatch <= 0) return [];

    let mainPrompt = "";
    const parts: any[] = [];

    if (filePart) {
      parts.push(filePart);
      mainPrompt = `Analyze the document provided.`;
    } else if (topic) {
      mainPrompt = `Topic: "${topic}".`;
    } else {
      throw new Error("File or Topic required.");
    }

    const finalPrompt = `
      ${mainPrompt}
      Task: Create exactly ${questionsForThisBatch} questions (Batch ${currentBatchNum}).
      Language: INDONESIAN (Formal, Academic).
      ${stylePrompt}
      ${duplicateGuard}

      CRITICAL RULES FOR EXPLANATION (MANDATORY):
      1. **NO FLUFF**: Max 3 sentences (approx 30 words). Save tokens.
      2. **DIRECT**: Explain the *mechanism* or *scientific reason*.
      3. **FORBIDDEN PHRASES**: NEVER say "Teks menyatakan", "Menurut dokumen", "Secara eksplisit", "Jawaban yang benar adalah". 
      4. **INTELLIGENT**: Go straight to the logic. Example: Instead of "The text says kidneys detect O2", say "Kidneys receive high stable blood flow, making them ideal sensors for partial oxygen pressure changes."

      OUTPUT RULES:
      1. STRICT JSON Array format. 
      2. No markdown blocks.
      3. Options must be distinct.
      
      Structure: [{"text": "Short Question?", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "Direct scientific reasoning without filler.", "keyPoint": "1-2 Words Concept", "difficulty": "Medium"}]
    `;

    parts.push({ text: finalPrompt });

    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: { parts },
        config: { 
          responseMimeType: "application/json",
          temperature: 0.3 // Lower temperature for concise/strict output
        }
      });

      completedBatches++;
      onProgress(`Memproses Bagian ${completedBatches}/${totalBatches}...`);

      const text = response.text;
      if (!text) return [];

      let rawData;
      try {
        const cleaned = cleanJSON(text);
        rawData = JSON.parse(cleaned);
      } catch (parseError) {
        console.error("JSON Parse Error on Batch " + currentBatchNum, text);
        try {
           const obj = JSON.parse(text);
           if (obj.questions && Array.isArray(obj.questions)) rawData = obj.questions;
           else if (Array.isArray(obj)) rawData = obj;
        } catch(e) {
           return [];
        }
      }
      
      return Array.isArray(rawData) ? rawData.map(q => sanitizeQuestion(q)) : [];
    } catch (e) {
      console.warn(`Batch ${currentBatchNum} failed`, e);
      return [];
    }
  });

  const results = await Promise.all(batchPromises);
  let allQuestions: any[] = results.flat();

  if (allQuestions.length === 0) throw new Error("Gagal membuat soal. Respon AI kosong atau tidak valid.");

  const finalQuestions = allQuestions.map((q, index) => ({
    ...q,
    id: index + 1
  }));

  return { questions: finalQuestions, contextText };
};

export const explainQuestionDeeper = async (
  apiKey: string,
  question: Question
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Soal: "${question.text}"... Jawaban: ${question.options[question.correctIndex]}. Jelaskan mekanismenya secara padat, ilmiah, dan langsung (max 50 kata). Jangan pakai kata pengantar.`;
  try {
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return response.text || "Gagal.";
  } catch (e) { return "Error."; }
};

export const chatWithDocument = async (
  apiKey: string,
  modelId: string,
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  contextText: string,
  file: File | null
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  let systemInstruction = "You are a concise, helpful AI tutor. Answer directly without fluff.";
  const parts: any[] = [{ text: message }];
  if (contextText && !contextText.startsWith("[Binary File:")) {
     systemInstruction += `\n\nContext:\n${contextText.substring(0, 30000)}`; 
  }
  if (file && contextText.startsWith("[Binary File:")) {
    try {
      const filePart = await fileToGenerativePart(file);
       if ('inlineData' in filePart) parts.unshift(filePart);
    } catch (e) { console.error(e); }
  }
  try {
    const chat = ai.chats.create({
      model: modelId,
      config: { systemInstruction },
      history: history.map(h => ({ role: h.role, parts: h.parts }))
    });
    const result = await chat.sendMessage({ parts });
    return result.text || "No response.";
  } catch (e) { return "Error."; }
};
