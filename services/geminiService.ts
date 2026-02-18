
/**
 * ==========================================
 * GEMINI AI SERVICE (STRICT MODE + RAG)
 * ==========================================
 */

import { GoogleGenAI } from "@google/genai";
import { Question, QuizMode, ExamStyle } from "../types";

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
  let text = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstOpen = text.indexOf('[');
  const lastClose = text.lastIndexOf(']');

  if (firstOpen === -1 || lastClose === -1) throw new Error("Format JSON invalid.");
  const jsonContent = text.substring(firstOpen, lastClose + 1);

  try {
    return JSON.parse(jsonContent);
  } catch (e) {
    // Retry with simple fix for common trailing comma issues
    try { return JSON.parse(jsonContent.replace(/,\s*]/, ']')); } catch (e2) {}
    throw new Error("Gagal parsing output AI.");
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

export const generateQuiz = async (
  apiKey: string, 
  files: File[] | File | null, 
  topic: string | undefined, 
  modelId: string,
  questionCount: number,
  mode: QuizMode,
  examStyle: ExamStyle = ExamStyle.CONCEPTUAL,
  onProgress: (status: string) => void,
  existingQuestionsContext: string[] = [],
  customPrompt: string = "",
  libraryContext: string = "" // NEW: Text content from Library
): Promise<{ questions: Question[], contextText: string }> => {
  
  if (!apiKey) throw new Error("API Key Gemini belum diatur.");
  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  const parts: any[] = [];
  let contextText = ""; 

  // 1. Handle Library Context (Text Based)
  if (libraryContext) {
     onProgress("Memuat Library Materi...");
     parts.push({ text: `REFERENCE MATERIAL:\n${libraryContext.substring(0, 500000)}` }); // Limit to safe token count
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
    parts.push({ text: `IMPORTANT: FOCUS ONLY ON THIS TOPIC: "${topic}". Ignore unrelated parts of the reference material.` });
  }

  let avoidancePrompt = "";
  if (existingQuestionsContext.length > 0) {
      const prevTopics = existingQuestionsContext.map(q => q.substring(0, 20)).slice(-20).join(", ");
      avoidancePrompt = `DO NOT repeat these questions: [${prevTopics}].`;
  }

  const finalPrompt = `
    ROLE: Strict Academic Examiner.
    TASK: Create EXACTLY ${questionCount} multiple-choice questions in INDONESIAN.
    
    STRICT RULES (ANTI-HALLUCINATION):
    1. USE ONLY the Reference Material provided above. If the answer is not in the material, do not invent it.
    2. FOCUS strictly on the Topic: "${topic || 'General'}".
    3. IF MATERIAL IS EMPTY/UNREADABLE, return an error JSON with "text": "ERROR: Materi kosong/tidak terbaca".
    4. NO META QUESTIONS like "What is discussed on page 1?". Ask about the CONCEPTS.
    5. Difficulty: ${examStyle}.
    
    USER CUSTOM INSTRUCTIONS:
    "${customPrompt}"

    JSON FORMAT (Array):
    [
      {
        "text": "Question?",
        "options": ["A", "B", "C", "D"],
        "correctIndex": 0,
        "explanation": "Why correct...",
        "keyPoint": "Tag",
        "difficulty": "Medium"
      }
    ]
    ${avoidancePrompt}
  `;

  parts.push({ text: finalPrompt });

  onProgress(`Menyusun ${questionCount} soal berkualitas...`);
  
  try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: { parts },
        config: { 
          responseMimeType: "application/json", 
          temperature: 0.3, 
          maxOutputTokens: 8192, 
        }
      });

      const responseText = response.text;
      if (!responseText) throw new Error("AI Empty Response");

      onProgress("Memvalidasi Soal...");
      const rawQuestions = cleanAndParseJSON(responseText);

      if (!Array.isArray(rawQuestions)) throw new Error("Format AI salah (Bukan Array).");
      if (rawQuestions.length > 0 && rawQuestions[0].text.includes("ERROR:")) throw new Error(rawQuestions[0].text);

      const finalQuestions = rawQuestions.map((q, index) => ({
        ...sanitizeQuestion(q),
        id: index + 1
      }));

      return { questions: finalQuestions, contextText };

  } catch (err: any) {
      console.error("Gemini Error:", err);
      if (err.message.includes("400")) throw new Error("File terlalu besar atau API Error.");
      throw err;
  }
};

export const chatWithDocument = async (apiKey: string, modelId: string, history: any[], message: string, contextText: string, file: File | null) => {
  return "Fitur chat sedang dalam perbaikan."; 
};
