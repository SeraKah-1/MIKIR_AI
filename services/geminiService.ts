/**
 * ==========================================
 * GEMINI AI SERVICE (BATCHED & PARALLEL)
 * ==========================================
 */

import { GoogleGenAI } from "@google/genai";
import { Question, QuizMode, ExamStyle } from "../types";

const BATCH_SIZE = 30; 

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

const cleanJSON = (text: string) => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
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

  return {
    text: String(q.text || "Pertanyaan kosong (Error AI)"),
    options: options,
    correctIndex: correctIndex,
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
  onProgress: (status: string) => void 
): Promise<{ questions: Question[], contextText: string }> => {
  
  if (!apiKey) throw new Error("API Key belum diatur. Silakan ke menu Settings.");

  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  // Handle File Input if present
  let filePart = null;
  let contextText = ""; // To store text for Chat feature

  if (file) {
    filePart = await fileToGenerativePart(file);
    // Note: For PDF/Image inputs, we can't easily get text back from Gemini here without a separate call.
    // For Chat later, we will re-send the filePart.
    // If it's text file, we store it.
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

  const batchPromises = Array.from({ length: totalBatches }).map(async (_, i) => {
    const currentBatchNum = i + 1;
    const isLastBatch = i === totalBatches - 1;
    const questionsForThisBatch = isLastBatch 
      ? questionCount - (i * BATCH_SIZE) 
      : BATCH_SIZE;

    let specificInstruction = "";
    if (mode === QuizMode.SCAFFOLDING) specificInstruction += `MODE: SCAFFOLDING (Guided Learning). Mix difficulties.`;
    else if (mode === QuizMode.SURVIVAL) specificInstruction += `MODE: SURVIVAL. High difficulty.`;
    else if (mode === QuizMode.TIME_RUSH) specificInstruction += `MODE: TIME RUSH. Concise questions.`;

    let stylePrompt = "";
    switch (examStyle) {
      case ExamStyle.CONCEPTUAL: stylePrompt = `FOCUS: BASIC CONCEPTS (Bloom's C1/C2). Definitions, facts.`; break;
      case ExamStyle.ANALYTICAL: stylePrompt = `FOCUS: ANALYTICAL (Bloom's C4/C5). Logic, inference.`; break;
      case ExamStyle.CASE_STUDY: stylePrompt = `FOCUS: APPLICATION (Bloom's C3). Case studies.`; break;
      case ExamStyle.COMPETITIVE: stylePrompt = `FOCUS: COMPETITIVE. Tricky details, distractors.`; break;
      default: stylePrompt = `FOCUS: Balanced.`; break;
    }

    const contextPrompt = totalBatches > 1 ? `Part ${currentBatchNum} of ${totalBatches}.` : "";

    // CONSTRUCT PROMPT BASED ON FILE OR TOPIC
    let mainPrompt = "";
    const parts: any[] = [];

    if (filePart) {
      parts.push(filePart);
      mainPrompt = `Analyze the document provided. Create exactly ${questionsForThisBatch} questions.`;
    } else if (topic) {
      mainPrompt = `Create exactly ${questionsForThisBatch} questions about the topic: "${topic}".`;
    } else {
      throw new Error("File or Topic required.");
    }

    const finalPrompt = `
      ${mainPrompt}
      Language: INDONESIAN.
      ${contextPrompt}
      INSTRUCTIONS: ${specificInstruction} ${stylePrompt}
      OUTPUT: JSON Array only.
      [{"text": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "...", "keyPoint": "Topic", "difficulty": "Easy"}]
    `;

    parts.push({ text: finalPrompt });

    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: { parts },
        config: { responseMimeType: "application/json" }
      });

      completedBatches++;
      onProgress(`Memproses Bagian ${completedBatches}/${totalBatches}...`);

      const text = response.text;
      if (!text) return [];

      const rawData = JSON.parse(cleanJSON(text));
      return Array.isArray(rawData) ? rawData.map(q => sanitizeQuestion(q)) : [];
    } catch (e) {
      console.warn(`Batch ${currentBatchNum} failed`, e);
      return [];
    }
  });

  const results = await Promise.all(batchPromises);
  let allQuestions: any[] = results.flat();

  if (allQuestions.length === 0) throw new Error("Gagal membuat soal. Cek API Key atau koneksi internet.");

  onProgress("Finalisasi...");

  let finalQuestions: Question[] = allQuestions.map((q, index) => ({
    ...q,
    id: index + 1
  }));

  if (mode === QuizMode.SCAFFOLDING) {
    const difficultyOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
    finalQuestions = finalQuestions.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);
  }

  return { questions: finalQuestions, contextText };
};

// --- EXPLAIN DEEPER ---
export const explainQuestionDeeper = async (
  apiKey: string,
  question: Question
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `
    Soal: "${question.text}"
    Pilihan: ${question.options.join(', ')}
    Jawaban Benar: ${question.options[question.correctIndex]}

    Tugas: Jelaskan kenapa jawaban tersebut benar dengan bahasa yang sangat sederhana (seperti menjelaskan ke anak 10 tahun). Berikan analogi atau contoh nyata jika memungkinkan. Maksimal 3 kalimat pendek. Bahasa Indonesia.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: prompt
    });
    return response.text || "Gagal mendapatkan penjelasan tambahan.";
  } catch (e) {
    return "Maaf, AI sedang sibuk. Coba lagi nanti.";
  }
};

// --- CHAT WITH DOCUMENT ---
export const chatWithDocument = async (
  apiKey: string,
  modelId: string,
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  contextText: string,
  file: File | null
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  
  let systemInstruction = "You are a helpful AI tutor. Answer based on the context provided.";
  
  const parts: any[] = [{ text: message }];

  // If context is text-based, add to system instruction
  if (contextText && !contextText.startsWith("[Binary File:")) {
     systemInstruction += `\n\nContext:\n${contextText.substring(0, 30000)}`; 
  }
  
  // If context is binary (PDF/Image), attach to the message
  if (file && contextText.startsWith("[Binary File:")) {
    try {
      const filePart = await fileToGenerativePart(file);
       // fileToGenerativePart returns { inlineData: ... } or { text: ... }
       if ('inlineData' in filePart) {
         parts.unshift(filePart);
       }
    } catch (e) {
      console.error("File processing error", e);
    }
  }

  try {
    const chat = ai.chats.create({
      model: modelId,
      config: {
        systemInstruction
      },
      history: history.map(h => ({ role: h.role, parts: h.parts }))
    });

    const result = await chat.sendMessage({ parts });
    return result.text || "Tidak ada jawaban.";
  } catch (e) {
    console.error(e);
    return "Maaf, terjadi kesalahan saat menghubungi AI.";
  }
};