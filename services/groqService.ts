
/**
 * ==========================================
 * GROQ CLOUD SERVICE (BATCHED & OPTIMIZED)
 * ==========================================
 */

import { Question, QuizMode, ExamStyle } from "../types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const BATCH_SIZE = 10; // Groq is fast but context window for output is sensitive. Smaller batches = safer JSON.

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

// Helper to extract text from PDF using pdf.js
const extractPdfText = async (file: File): Promise<string> => {
  try {
    // @ts-ignore
    const pdfjs = window.pdfjsLib;
    if (!pdfjs) throw new Error("PDF Library not loaded.");

    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = "";
    const maxPages = Math.min(pdf.numPages, 15); // Increased page limit slightly

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }

    if (pdf.numPages > maxPages) {
      fullText += `\n... (Truncated. Analyzed first ${maxPages} of ${pdf.numPages} pages)`;
    }

    return fullText;
  } catch (error: any) {
    console.error("PDF Parse Error:", error);
    throw new Error("Gagal membaca file PDF. Pastikan file tidak terkunci password.");
  }
};

const processFileContent = async (file: File): Promise<string> => {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();

  if (fileType === "application/pdf" || fileName.endsWith('.pdf')) {
    return await extractPdfText(file);
  }
  
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

  throw new Error(`Groq hanya mendukung PDF dan Text. File ${fileName} tidak didukung.`);
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
  const correctContent = options[correctIndex];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  const newCorrectIndex = options.indexOf(correctContent);

  return {
    text: String(q.text || "Pertanyaan kosong (Error AI)"),
    options: options,
    correctIndex: newCorrectIndex !== -1 ? newCorrectIndex : 0,
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
  onProgress: (status: string) => void,
  existingQuestionsContext: string[] = [] // NEW: For "Add Questions" feature
): Promise<{ questions: Question[], contextText: string }> => {

  if (!apiKey) throw new Error("Groq API Key belum diatur.");

  // 1. Prepare Content
  let userContent = "";
  let extractedText = "";

  if (file) {
    onProgress("Mengekstrak teks dari file...");
    extractedText = await processFileContent(file);
    const safeText = extractedText.substring(0, 25000); // Safe token limit
    userContent = `SOURCE MATERIAL:\n${safeText}\n\n`;
  } else if (topic) {
    userContent = `TOPIC: "${topic}".\n`;
    extractedText = topic;
  } else {
    throw new Error("File or Topic required.");
  }

  // 2. Prepare Style Prompt (Enhanced)
  let styleInstruction = "";
  switch (examStyle) {
    case ExamStyle.CONCEPTUAL: 
      styleInstruction = "STYLE: ESSENTIALIST. Questions must be concise. Focus on underlying principles (Why/How)."; 
      break;
    case ExamStyle.ANALYTICAL: 
      styleInstruction = "STYLE: LOGIC PUZZLE. Connect concepts. Inferred answers only."; 
      break;
    case ExamStyle.CASE_STUDY: 
      styleInstruction = "STYLE: SCENARIO. Brief real world application situation."; 
      break;
    case ExamStyle.COMPETITIVE: 
      styleInstruction = "STYLE: OLYMPIAD. High difficulty, tricky distractors."; 
      break;
  }

  // Duplicate Prevention Prompt
  let avoidPrompt = "";
  if (existingQuestionsContext.length > 0) {
    // We only pass the last 20 questions titles to save tokens, usually enough to give context
    const snippet = existingQuestionsContext.slice(-20).join("; ");
    avoidPrompt = `IGNORE these existing questions: [${snippet}]. Generate BRAND NEW content.`;
  }

  const systemPrompt = `
    You are a Smart Professor.
    
    RULES:
    1. STRICT JSON OUTPUT: Return ONLY a JSON Array. No markdown formatting.
    2. LANGUAGE: Indonesian (Bahasa Indonesia).
    3. SOURCE TRUTH: Use ONLY the provided Source Material.
    4. QUALITY: Avoid repetitive patterns. Ensure options are plausible.
    5. DIFFICULTY: ${mode === QuizMode.SURVIVAL ? "Hard/Very Hard" : "Mixed difficulty"}.
    ${styleInstruction}
    ${avoidPrompt}

    EXPLANATION RULES (STRICT):
    - KEEP IT SHORT: Maximum 40 words.
    - NO FILLER: NEVER use "Teks menyatakan", "Dokumen menyebutkan", "Jawaban benar adalah".
    - BE DIRECT: Explain the *scientific mechanism* or *logic* immediately.
    - EXAMPLE: instead of "Text says X", say "X occurs because Y triggers Z."

    JSON FORMAT:
    [
      {
        "text": "Question...",
        "options": ["A","B","C","D"],
        "correctIndex": 0,
        "explanation": "Concise scientific reasoning.",
        "keyPoint": "Specific Concept",
        "difficulty": "Medium"
      }
    ]
  `;

  // 3. Batch Processing Logic
  const totalBatches = Math.ceil(questionCount / BATCH_SIZE);
  let allQuestions: any[] = [];
  
  // We process sequentially to maintain context logic if needed, but parallel is faster.
  // For Groq (Rate Limits), sequential or small parallel is better. Let's do sequential for safety.
  
  for (let i = 0; i < totalBatches; i++) {
    const currentBatchSize = (i === totalBatches - 1) 
      ? questionCount - (i * BATCH_SIZE) 
      : BATCH_SIZE;

    onProgress(`Groq: Mengenerate Batch ${i + 1}/${totalBatches}...`);

    try {
        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              messages: [
                { role: "system", content: systemPrompt },
                { 
                    role: "user", 
                    content: userContent + `\n\nTask: Generate batch ${i+1} of ${totalBatches}. Create exactly ${currentBatchSize} unique questions.` 
                }
              ],
              model: modelId,
              temperature: 0.4, 
              max_tokens: 4096 
            })
          });
      
          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Groq API Error");
          }
      
          const data = await response.json();
          const content = data.choices[0]?.message?.content;
      
          if (!content) continue;
      
          try {
            const cleaned = cleanJSON(content);
            const rawData = JSON.parse(cleaned);
            
            let batchQuestions = [];
            if (Array.isArray(rawData)) batchQuestions = rawData;
            else if (rawData.questions) batchQuestions = rawData.questions;
            
            allQuestions = [...allQuestions, ...batchQuestions];
            
          } catch (e) {
            console.warn(`Batch ${i+1} JSON parse failed`, e);
          }

    } catch (err) {
        console.error(`Batch ${i+1} failed`, err);
        // Continue to next batch even if one fails
    }
  }

  if (allQuestions.length === 0) throw new Error("Gagal membuat soal. Respon AI tidak valid atau kosong.");

  const sanitized = allQuestions.map(q => sanitizeQuestion(q));

  return { 
    questions: sanitized.map((q, i) => ({ ...q, id: i + 1 })), // Re-index locally
    contextText: extractedText
  };
};
