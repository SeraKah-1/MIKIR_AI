
/**
 * ==========================================
 * GROQ CLOUD SERVICE
 * ==========================================
 */

import { Question, QuizMode, ExamStyle } from "../types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Helper to clean JSON string aggressively
const cleanJSON = (text: string) => {
  // 1. Remove markdown code blocks
  let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  
  // 2. Scan for the first '[' or '{' to ignore intro text
  const firstSquare = cleaned.indexOf('[');
  const firstCurly = cleaned.indexOf('{');
  
  // Logic: find which comes first, assuming one exists
  let startIndex = -1;
  if (firstSquare !== -1 && firstCurly !== -1) {
    startIndex = Math.min(firstSquare, firstCurly);
  } else if (firstSquare !== -1) {
    startIndex = firstSquare;
  } else if (firstCurly !== -1) {
    startIndex = firstCurly;
  }

  // If found start, slice from there
  if (startIndex !== -1) {
    cleaned = cleaned.substring(startIndex);
  }

  // 3. Scan for the last ']' or '}'
  const lastSquare = cleaned.lastIndexOf(']');
  const lastCurly = cleaned.lastIndexOf('}');
  
  let endIndex = -1;
  if (lastSquare !== -1 && lastCurly !== -1) {
    endIndex = Math.max(lastSquare, lastCurly);
  } else if (lastSquare !== -1) {
    endIndex = lastSquare;
  } else if (lastCurly !== -1) {
    endIndex = lastCurly;
  }

  if (endIndex !== -1) {
    cleaned = cleaned.substring(0, endIndex + 1);
  }
  
  return cleaned;
};

// Helper to extract text from PDF using pdf.js (loaded in index.html)
const extractPdfText = async (file: File): Promise<string> => {
  try {
    // @ts-ignore - pdfjsLib is loaded via CDN in index.html
    const pdfjs = window.pdfjsLib;
    if (!pdfjs) throw new Error("PDF Library not loaded.");

    // Set worker source to Cloudflare CDN to match the library version
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = "";
    // Limit to first 10 pages to avoid browser freeze/memory issues and token limits
    const maxPages = Math.min(pdf.numPages, 10); 

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }

    if (pdf.numPages > 10) {
      fullText += `\n... (Truncated. Analyzed first 10 of ${pdf.numPages} pages)`;
    }

    return fullText;
  } catch (error: any) {
    console.error("PDF Parse Error:", error);
    throw new Error("Gagal membaca file PDF. Pastikan file tidak terkunci password.");
  }
};

// Main helper to route file processing
const processFileContent = async (file: File): Promise<string> => {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  // 1. Handle PDF
  if (fileType === "application/pdf" || fileName.endsWith('.pdf')) {
    return await extractPdfText(file);
  }
  
  // 2. Handle Text-based files (TXT, MD, CSV, JSON)
  if (
    fileType.startsWith('text/') || 
    fileName.endsWith('.txt') || 
    fileName.endsWith('.md') || 
    fileName.endsWith('.csv') ||
    fileName.endsWith('.json')
  ) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(new Error("Gagal membaca file text."));
      reader.readAsText(file);
    });
  }

  // 3. Block Binary Files (PPT, DOC, Images) for Groq
  // Groq API accepts text prompts. Sending binary data as text results in hallucination.
  if (
    fileName.endsWith('.ppt') || 
    fileName.endsWith('.pptx') || 
    fileName.endsWith('.doc') || 
    fileName.endsWith('.docx') ||
    fileName.endsWith('.xls') ||
    fileName.endsWith('.xlsx')
  ) {
    throw new Error(
      `Groq tidak dapat membaca file ${fileName} secara langsung. Silakan CONVERT ke PDF terlebih dahulu, atau gunakan provider 'Gemini' yang mendukung file native.`
    );
  }

  throw new Error(`Format file tidak dikenali: ${file.name}. Harap gunakan PDF atau Text.`);
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

export const generateQuizGroq = async (
  apiKey: string,
  file: File | null,
  topic: string | undefined,
  modelId: string,
  questionCount: number,
  mode: QuizMode,
  examStyle: ExamStyle,
  onProgress: (status: string) => void
): Promise<{ questions: Question[], contextText: string }> => {

  if (!apiKey) throw new Error("Groq API Key belum diatur.");

  onProgress("Menghubungkan ke Groq Cloud...");

  // 1. Prepare Content
  let userContent = "";
  let extractedText = "";

  if (file) {
    onProgress("Mengekstrak teks dari file...");
    try {
      extractedText = await processFileContent(file);
    } catch (e: any) {
      throw e; // Re-throw error from processFileContent (like the PPTX error)
    }
    
    // Check if extraction resulted in empty string
    if (!extractedText || extractedText.trim().length < 50) {
        if (file.type === 'application/pdf') {
             throw new Error("Teks PDF tidak terbaca. Pastikan PDF berisi teks yang bisa diseleksi (bukan hasil scan/gambar).");
        }
    }

    const safeText = extractedText.substring(0, 30000); // Safe limit token
    userContent = `SOURCE MATERIAL:\n${safeText}\n\n`;
  } else if (topic) {
    userContent = `TOPIC: "${topic}".\n`;
    extractedText = topic;
  } else {
    throw new Error("File or Topic required.");
  }

  // 2. Prepare System Prompt (IMPROVED FOR BETTER QUESTIONS)
  let styleInstruction = "";
  switch (examStyle) {
    case ExamStyle.CONCEPTUAL: 
      styleInstruction = "Focus on DEFINITIONS, TERMINOLOGY, and KEY FACTS. Questions should test memory."; 
      break;
    case ExamStyle.ANALYTICAL: 
      styleInstruction = "Focus on WHY and HOW. Ask about relationships between concepts, cause-and-effect, and logic."; 
      break;
    case ExamStyle.CASE_STUDY: 
      styleInstruction = "Create SCENARIO-BASED questions. 'If X happens, what should Y do?'. Apply concepts to real situations."; 
      break;
    case ExamStyle.COMPETITIVE: 
      styleInstruction = "Make questions VERY DIFFICULT. Use distractors (wrong options) that look very similar to the correct answer."; 
      break;
  }

  const systemPrompt = `
    You are an expert exam creator. Your goal is to create a High-Quality Exam based strictly on the provided text.

    CRITICAL RULES (DO NOT IGNORE):
    1. SOURCE MATERIAL AUTHORITY: Use ONLY the information provided in the SOURCE MATERIAL. Do NOT use outside knowledge unless the source text is too short (less than 100 words), in which case use the Topic as a seed.
    2. NO METADATA QUESTIONS: Do NOT ask about the author, the document title, page numbers, or "What is this document about?".
    3. CONTENT ONLY: Ask ONLY about the subject matter (Physics, Biology, Law, etc.) found within the text.
    4. LANGUAGE: Output in INDONESIAN (Bahasa Indonesia).
    5. FORMAT: Return ONLY raw JSON. Do NOT wrap in markdown blocks. Do NOT include any intro text.
    
    EXAM SPECS:
    - Count: Exactly ${questionCount} questions.
    - Style: ${styleInstruction}
    - Difficulty Mix: 30% Easy, 50% Medium, 20% Hard.

    JSON STRUCTURE:
    {
      "questions": [
        {
          "text": "Question content...",
          "options": ["A", "B", "C", "D"],
          "correctIndex": 0,
          "explanation": "Detailed explanation in Indonesian...",
          "keyPoint": "Specific Topic Tag (e.g. 'Thermodynamics' not just 'Science')",
          "difficulty": "Medium"
        }
      ]
    }
  `;

  // 3. Fetch from Groq
  try {
    onProgress("Mengirim data ke AI (Groq)...");
    
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent + `\n\nGenerate exactly ${questionCount} questions in valid JSON.` }
        ],
        model: modelId,
        temperature: 0.3, // Lower temperature for more stability
        max_tokens: 8192 // Ensure enough tokens for long JSON
        // Note: We removed 'response_format: { type: "json_object" }' because it causes errors with some models/prompts on Groq.
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Groq API Error");
    }

    onProgress("Memproses jawaban Groq...");

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) throw new Error("No content received from Groq");

    let rawData: any;
    try {
      const cleaned = cleanJSON(content);
      rawData = JSON.parse(cleaned);
    } catch (e) {
      console.warn("JSON Parse Fail (First Attempt):", e);
      throw new Error("Gagal memproses JSON dari Groq. Silakan coba lagi atau kurangi jumlah soal.");
    }

    let rawQuestions: any[] = [];
    
    // Normalization logic (Handle array or object wrapper)
    if (Array.isArray(rawData)) {
      rawQuestions = rawData;
    } 
    else if (rawData.questions && Array.isArray(rawData.questions)) {
      rawQuestions = rawData.questions;
    } 
    else {
      // Fallback search keys
      const keys = Object.keys(rawData);
      for (const key of keys) {
        if (Array.isArray(rawData[key])) {
          rawQuestions = rawData[key];
          break;
        }
      }
    }

    if (!rawQuestions || rawQuestions.length === 0) throw new Error("AI did not return a valid 'questions' array");

    const sanitized = rawQuestions.map((q: any) => sanitizeQuestion(q));

    return { 
      questions: sanitized.map((q, i) => ({ ...q, id: i + 1 })),
      contextText: extractedText
    };

  } catch (error: any) {
    console.error("Groq Service Error:", error);
    throw new Error(`${error.message}`);
  }
};
