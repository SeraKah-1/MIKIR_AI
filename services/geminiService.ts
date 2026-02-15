
/**
 * ==========================================
 * GEMINI AI SERVICE (ONE-SHOT SPEED MODE)
 * ==========================================
 * Strategi: Tembak sekali (One-Shot). 
 * Gemini 1.5 Flash/Pro kuat menampung konteks besar dan output panjang.
 * Ini memangkas waktu tunggu HTTP request berulang.
 */

import { GoogleGenAI } from "@google/genai";
import { Question, QuizMode, ExamStyle } from "../types";

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

// --- ULTRA ROBUST JSON PARSER ---
// Membersihkan segala macam sampah yang mungkin dikirim LLM sebelum/sesudah JSON
const cleanAndParseJSON = (rawText: string): any[] => {
  let text = rawText;
  
  // 1. Hapus Markdown Code Blocks
  text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  // 2. Cari kurung siku terluar [ ... ]
  const firstOpen = text.indexOf('[');
  const lastClose = text.lastIndexOf(']');

  if (firstOpen === -1 || lastClose === -1) {
     throw new Error("Format JSON tidak valid (Tidak ada Array).");
  }

  // 3. Ambil isinya saja
  const jsonContent = text.substring(firstOpen, lastClose + 1);

  try {
    return JSON.parse(jsonContent);
  } catch (e) {
    // 4. Emergency Fix: Common AI Error where it misses a comma between objects
    // Pattern: } {  --> }, {
    // Pattern: } \n { --> }, {
    try {
        const patched = jsonContent.replace(/}\s*{/g, "},{");
        return JSON.parse(patched);
    } catch (e2) {
        console.error("JSON Critical Fail:", rawText);
        throw new Error("Gagal memproses data soal (JSON Syntax Error).");
    }
  }
};

const sanitizeQuestion = (q: any): Omit<Question, 'id'> => {
  // Pastikan Options ada 4
  let options = Array.isArray(q.options) ? q.options : ["A", "B", "C", "D"];
  // Konversi ke string jika ada object aneh
  options = options.map((o: any) => (typeof o === 'object' ? JSON.stringify(o) : String(o)));
  
  while (options.length < 4) options.push(`Opsi ${options.length + 1}`);
  options = options.slice(0, 4);

  // Pastikan Correct Index Valid
  let correctIndex = Number(q.correctIndex);
  if (isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) correctIndex = 0;

  // --- SHUFFLE OPTIONS (Agar kunci jawaban tidak selalu A) ---
  // AI sering bias ke jawaban A. Kita acak di sini.
  const correctAnswerText = options[correctIndex];
  // Algoritma Fisher-Yates Shuffle sederhana untuk array options
  for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
  }
  // Cari index baru dari jawaban yang benar
  const newCorrectIndex = options.indexOf(correctAnswerText);

  return {
    text: String(q.text || "Soal Kosong"),
    options: options,
    correctIndex: newCorrectIndex,
    explanation: String(q.explanation || "Tidak ada pembahasan."),
    keyPoint: String(q.keyPoint || "Umum"),
    difficulty: (["Easy", "Medium", "Hard"].includes(q.difficulty) ? q.difficulty : "Medium") as any
  };
};

// --- MAIN ONE-SHOT FUNCTION ---
export const generateQuiz = async (
  apiKey: string, 
  file: File | null, 
  topic: string | undefined, 
  modelId: string,
  questionCount: number,
  mode: QuizMode,
  examStyle: ExamStyle = ExamStyle.CONCEPTUAL,
  onProgress: (status: string) => void,
  existingQuestionsContext: string[] = [] // Support untuk "Add More"
): Promise<{ questions: Question[], contextText: string }> => {
  
  if (!apiKey) throw new Error("API Key Gemini belum diatur.");

  const ai = new GoogleGenAI({ apiKey: apiKey });
  
  // 1. Prepare Content
  const parts: any[] = [];
  let contextText = ""; 

  if (file) {
    onProgress("Membaca & Mengompres Dokumen...");
    const filePart = await fileToGenerativePart(file);
    parts.push(filePart);
    if ('text' in filePart) contextText = filePart.text;
    else contextText = `[File: ${file.name}]`; 
  } else if (topic) {
    onProgress("Menganalisis Topik...");
    contextText = topic;
  }

  // 2. CONSTRUCT THE ULTIMATE PROMPT
  // Kita minta sekaligus semua soal. Gemini kuat menahan ribuan token output.
  
  let styleInstruction = "";
  switch (examStyle) {
    case ExamStyle.COMPETITIVE: styleInstruction = "HARD DIFFICULTY. Tricky distractors. UTBK/Olimpiade Level."; break;
    case ExamStyle.ANALYTICAL: styleInstruction = "Focus on CAUSE-AND-EFFECT relationships and logic."; break;
    case ExamStyle.CASE_STUDY: styleInstruction = "Use short real-world SCENARIOS/CASES as the question stem."; break;
    default: styleInstruction = "Academic Standard. Balanced difficulty."; break;
  }

  // Anti-Duplicate Strategy for "Add More" feature
  let avoidancePrompt = "";
  if (existingQuestionsContext.length > 0) {
      // Ambil kata kunci dari soal-soal sebelumnya (jangan kirim full text biar hemat token)
      const prevTopics = existingQuestionsContext
        .map(q => q.substring(0, 30))
        .filter((v, i, a) => a.indexOf(v) === i) // Unique
        .slice(-30) // Ambil 30 terakhir
        .join(", ");
        
      avoidancePrompt = `IMPORTANT: DO NOT create questions about these specific concepts again: [${prevTopics}]. Find NEW angles or details.`;
  }

  const finalPrompt = `
    ROLE: Expert Exam Creator.
    TASK: Generate EXACTLY ${questionCount} multiple-choice questions based on the attached input.
    LANGUAGE: INDONESIAN (Formal, Academic).
    STYLE: ${styleInstruction}
    ${avoidancePrompt}

    CRITICAL RULES:
    1. Output MUST be a SINGLE VALID JSON ARRAY.
    2. Do NOT use Markdown formatting like \`\`\`json. Just raw JSON.
    3. Ensure 'options' array has exactly 4 items.
    4. 'correctIndex' must be 0, 1, 2, or 3.
    5. 'explanation' should be concise (max 2 sentences).
    6. 'keyPoint' is a 1-3 word tag for the concept being tested.

    JSON STRUCTURE:
    [
      {
        "text": "Question text here?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctIndex": 0,
        "explanation": "Why A is correct...",
        "keyPoint": "Photosynthesis",
        "difficulty": "Medium"
      },
      ...
    ]
  `;

  parts.push({ text: finalPrompt });

  // 3. EXECUTE ONE-SHOT
  onProgress(`Meng-generate ${questionCount} soal sekaligus...`);
  
  try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: { parts },
        config: { 
          responseMimeType: "application/json", // Force JSON Mode (Gemini Feature)
          temperature: 0.4, // Rendah agar patuh format, tapi tidak 0 agar kreatif
          maxOutputTokens: 8192, // Max out the output buffer
        }
      });

      const responseText = response.text;
      
      if (!responseText) throw new Error("AI memberikan respon kosong.");

      onProgress("Finishing & Parsing...");
      const rawQuestions = cleanAndParseJSON(responseText);

      if (!Array.isArray(rawQuestions)) throw new Error("AI tidak mengembalikan Array.");

      // Sanitize & ID Assignment
      const finalQuestions = rawQuestions.map((q, index) => ({
        ...sanitizeQuestion(q),
        id: index + 1
      }));

      // Validasi jumlah (kadang AI generate kurang/lebih sedikit, kita toleransi)
      if (finalQuestions.length === 0) throw new Error("Array soal kosong.");

      return { questions: finalQuestions, contextText };

  } catch (err: any) {
      console.error("Gemini One-Shot Error:", err);
      // Fallback message yang lebih jelas
      if (err.message.includes("400")) throw new Error("Model Overloaded atau File terlalu besar. Coba kurangi jumlah soal.");
      throw err;
  }
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
  
  const systemInstruction = `
    Anda adalah Tutor AI yang cerdas dan to-the-point.
    Jawab pertanyaan user berdasarkan konteks dokumen yang diberikan.
    Jika tidak ada di dokumen, gunakan pengetahuan umum tapi beri disclaimer.
    Bahasa: Indonesia Formal-Santai.
  `;

  // Construct initial context if creating new chat
  // Note: Gemini API manages history in the object itself mostly, 
  // but we pass context in the system instruction or first message for robustness.
  
  const parts: any[] = [{ text: message }];
  
  // Attach file/context to the VERY FIRST turn implicitly by checking history length
  // But simpler approach: Send context as a hidden system-like prompt in the chat session init
  
  try {
    const chat = ai.chats.create({
      model: modelId,
      config: { systemInstruction },
      history: history.map(h => ({ role: h.role, parts: h.parts }))
    });
    
    // If there is a file, we should technically add it to history or use generateContent for single turn.
    // For Chat interface, we assume text context is sufficient for now or handled via system prompt.
    // Enhanced: If contextText is available, prepend it to the message invisible to user? 
    // Better: Rely on the fact that 'contextText' is passed.
    
    if (contextText && history.length === 0) {
        // Inject context into the first message content invisibly
        parts[0].text = `CONTEXT: ${contextText.substring(0, 50000)} \n\n QUESTION: ${message}`;
    }

    const result = await chat.sendMessage({ parts });
    return result.text || "Tidak ada respon.";
  } catch (e) { 
    return "Maaf, terjadi kesalahan saat menghubungi AI."; 
  }
};
