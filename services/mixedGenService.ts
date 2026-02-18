
/**
 * ==========================================
 * MIXED GENERATION SERVICE (New Feature)
 * Handles creating JSON for MCQ, T/F, and Fill-in-the-blank
 * ==========================================
 */

import { GoogleGenAI } from "@google/genai";
import { Question, QuizMode, ExamStyle } from "../types";

const cleanAndParseJSON = (rawText: string): any[] => {
  // 1. Remove <thinking> tags (Crucial for Gemini 2.0/3.0 Thinking models)
  let text = rawText.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();

  // 2. Cleanup Markdown
  text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  // 3. Isolate the JSON Array
  const firstOpen = text.indexOf('[');
  const lastClose = text.lastIndexOf(']');

  // 4. Fallback: Check for Object Wrapper
  if (firstOpen === -1 || lastClose === -1) {
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
      throw new Error("Format JSON invalid (Tidak ada Array ditemukan).");
  }

  const jsonContent = text.substring(firstOpen, lastClose + 1);

  try {
    return JSON.parse(jsonContent);
  } catch (e) {
    try { 
        // Robust Trailing Comma Fix
        const fixedContent = jsonContent.replace(/,\s*([\]}])/g, '$1');
        return JSON.parse(fixedContent); 
    } catch (e2) {
        console.error("Mixed Gen Parse Error. Raw:", rawText);
        throw new Error("Gagal parsing output AI (Mixed Mode).");
    }
  }
};

const sanitizeMixedQuestion = (q: any, idx: number): Question => {
  let type = q.type || 'MULTIPLE_CHOICE';
  let options = q.options || [];
  let correctAnswer = q.correctAnswer || "";
  let correctIndex = q.correctIndex || 0;

  // 1. TRUE/FALSE Normalization
  if (type === 'TRUE_FALSE') {
     options = ["Benar", "Salah"];
     // AI might return correctIndex 0/1 or boolean true/false
     if (typeof q.correctAnswer === 'boolean') {
        correctIndex = q.correctAnswer ? 0 : 1;
     } else if (typeof q.correctAnswer === 'string') {
        correctIndex = q.correctAnswer.toLowerCase() === 'benar' ? 0 : 1;
     }
  }

  // 2. FILL_BLANK Normalization
  if (type === 'FILL_BLANK') {
     options = []; // No options for fill blank
     if (!correctAnswer && q.answer) correctAnswer = q.answer;
  }

  // 3. MCQ Normalization
  if (type === 'MULTIPLE_CHOICE') {
     if (!Array.isArray(options) || options.length < 2) {
        options = ["A", "B", "C", "D"];
     }
  }

  return {
    id: idx + 1,
    type: type,
    text: q.text || "Pertanyaan Kosong",
    options: options,
    correctIndex: Number(correctIndex),
    correctAnswer: String(correctAnswer),
    explanation: q.explanation || "Tidak ada pembahasan.",
    keyPoint: q.keyPoint || "Umum",
    difficulty: "Medium"
  };
};

export const generateMixedQuiz = async (
  apiKey: string, 
  contextText: string,
  topic: string,
  modelId: string,
  questionCount: number,
  onProgress: (status: string) => void
): Promise<Question[]> => {
  
  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  // Prompt khusus untuk Variasi Soal
  const finalPrompt = `
    ROLE: Dynamic Exam Generator.
    TASK: Create ${questionCount} questions in INDONESIAN based on the context below.
    
    CRITICAL REQUIREMENT: MIX THE QUESTION TYPES!
    Do not just create Multiple Choice. Use the following distribution:
    - 60% Multiple Choice (MULTIPLE_CHOICE)
    - 20% True or False (TRUE_FALSE)
    - 20% Fill in the Blank (FILL_BLANK) - Short answer, 1-2 words max.

    CONTEXT:
    "${contextText.substring(0, 40000)}"
    
    TOPIC FOCUS: ${topic}

    OUTPUT JSON FORMAT (Array of Objects):
    [
      {
        "type": "MULTIPLE_CHOICE",
        "text": "Apa ibukota Indonesia?",
        "options": ["Bandung", "Jakarta", "Surabaya", "Medan"],
        "correctIndex": 1,
        "explanation": "Jakarta adalah ibukota.",
        "keyPoint": "Geografi"
      },
      {
        "type": "TRUE_FALSE",
        "text": "Matahari terbit dari barat.",
        "correctAnswer": false, 
        "explanation": "Matahari terbit dari timur.",
        "keyPoint": "Astronomi"
      },
      {
        "type": "FILL_BLANK",
        "text": "Hewan pemakan daging disebut [...]",
        "correctAnswer": "Karnivora",
        "explanation": "Karnivora berasal dari latin carno.",
        "keyPoint": "Biologi"
      }
    ]
  `;

  onProgress(`Meracik ${questionCount} soal (Campuran)...`);
  
  try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: { parts: [{ text: finalPrompt }] },
        config: { 
          responseMimeType: "application/json", 
          temperature: 0.4, // Agak kreatif untuk variasi
          maxOutputTokens: 8192, 
        }
      });

      const responseText = response.text;
      if (!responseText) throw new Error("AI Empty Response");

      onProgress("Memvalidasi Format Soal...");
      const rawQuestions = cleanAndParseJSON(responseText);

      return rawQuestions.map((q, i) => sanitizeMixedQuestion(q, i));

  } catch (err: any) {
      console.error("Gemini Mixed Error:", err);
      throw new Error("Gagal membuat soal variasi.");
  }
};
