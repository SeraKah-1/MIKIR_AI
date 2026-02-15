
/**
 * ==========================================
 * GROQ CLOUD SERVICE (ROBUST & SLICED)
 * ==========================================
 * Perbaikan:
 * 1. Document Slicing: Dokumen dipecah per batch agar hemat token & anti-429.
 * 2. Defensive Parsing: Menangani JSON yang tidak sempurna (missing text field).
 * 3. Adaptive Backoff: Menangani Rate Limit dengan jeda waktu dinamis.
 */

import { Question, QuizMode, ExamStyle } from "../types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const BATCH_SIZE = 5; 
const MAX_RETRIES = 3; 

// --- ROBUST PARSING ---
const extractAndParseJSON = (text: string): any[] => {
  // Bersihkan markdown code blocks
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  // Cari array bracket terluar
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  
  if (start === -1 || end === -1) {
     // Fallback: Coba cari pattern object satu per satu jika array gagal
     if (cleaned.trim().startsWith('{')) {
        try { return [JSON.parse(cleaned)]; } catch(e) {}
     }
     return [];
  }

  cleaned = cleaned.substring(start, end + 1);
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Attempt fix trailing comma (Error umum Llama 3)
    try { return JSON.parse(cleaned.replace(/,\s*]/, ']')); } catch (e2) { return []; }
  }
};

// --- FILE EXTRACTION ---
const extractPdfText = async (file: File): Promise<string> => {
  try {
    // @ts-ignore
    const pdfjs = window.pdfjsLib;
    
    // Compatibility Check: Ensure library is loaded
    if (!pdfjs) {
        throw new Error("PDF Library belum siap. Coba refresh halaman.");
    }

    // Set worker explicitly to match the main library version to avoid version mismatch errors
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = "";
    // Limit to 15 pages to prevent crashing Mobile Browsers (Memory constraints)
    const maxPages = Math.min(pdf.numPages, 15); 

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += `[Page ${i}] ${pageText}\n`;
    }
    return fullText;
  } catch (error: any) {
    throw new Error("Gagal baca PDF: " + error.message);
  }
};

const processFileContent = async (file: File): Promise<string> => {
  if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
    return await extractPdfText(file);
  }
  return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsText(file);
  });
};

const sanitizeQuestion = (q: any): Question | null => {
  // 1. Defensive Check: Pastikan ada teks soal
  const qText = q.text || q.question || q.soal; 
  if (!qText || typeof qText !== 'string' || qText.length < 5) return null;

  // 2. Defensive Check: Options
  let options = Array.isArray(q.options) ? q.options : (q.choices || []);
  if (options.length < 2) return null;
  
  // Normalisasi Options
  options = options.map(String).slice(0, 4);
  while(options.length < 4) options.push("-");
  
  // 3. Handle Correct Index
  let correctIndex = 0;
  if (typeof q.correctIndex === 'number') correctIndex = q.correctIndex;
  else if (typeof q.answer === 'string') {
     const map: Record<string, number> = { 'A': 0, 'a': 0, 'B': 1, 'b': 1, 'C': 2, 'c': 2, 'D': 3, 'd': 3 };
     correctIndex = map[q.answer] || 0;
  }

  // Shuffle Options agar jawaban tidak selalu A
  const correctContent = options[correctIndex];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  
  return {
    id: 0, // Placeholder
    text: qText,
    options: options,
    correctIndex: options.indexOf(correctContent),
    explanation: q.explanation || q.pembahasan || "Tidak ada pembahasan detail.",
    keyPoint: q.keyPoint || q.topik || "Umum",
    difficulty: "Medium"
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
  existingQuestionsContext: string[] = [] 
): Promise<{ questions: Question[], contextText: string }> => {

  if (!apiKey) throw new Error("API Key Groq kosong.");

  // 1. Prepare Content 
  let contextMaterial = "";
  if (file) {
    onProgress("Membaca dokumen...");
    const rawText = await processFileContent(file);
    contextMaterial = rawText.substring(0, 30000); // Limit karakter lebih tinggi karena slicing
  } else {
    contextMaterial = topic || "";
  }

  // 2. Setup Batches
  const totalBatches = Math.ceil(questionCount / BATCH_SIZE);
  let allRawQuestions: any[] = [];
  
  // Hitung ukuran potongan teks per batch
  const chunkSize = Math.ceil(contextMaterial.length / totalBatches);

  for (let i = 0; i < totalBatches; i++) {
    const batchNum = i + 1;
    const needed = Math.min(BATCH_SIZE, questionCount - allRawQuestions.length);
    if (needed <= 0) break;

    // --- DOCUMENT SLICING ---
    const startIdx = i * chunkSize;
    const endIdx = Math.min((i + 1) * chunkSize, contextMaterial.length);
    // Overlap context sedikit (500 chars) agar tidak putus di tengah kalimat
    const batchContext = contextMaterial.substring(Math.max(0, startIdx - 500), endIdx);

    let success = false;
    let attempts = 0;

    while (!success && attempts < MAX_RETRIES) {
      attempts++;
      onProgress(`Groq: Membuat Paket Soal ${batchNum}/${totalBatches} (Percobaan ${attempts})...`);

      const prompt = `
        CONTEXT:
        """${batchContext}"""

        TASK:
        Create ${needed} multiple-choice questions in INDONESIAN based on the context above.
        Difficulty: ${examStyle}

        CRITICAL JSON FORMAT:
        [
          {
            "text": "Pertanyaan disini?",
            "options": ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"],
            "correctIndex": 0,
            "explanation": "Penjelasan singkat.",
            "keyPoint": "Topik Singkat"
          }
        ]

        RETURN ONLY RAW JSON. NO MARKDOWN.
      `;

      try {
        const response = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "system", content: "You are a quiz generator API. Output JSON only." },
              { role: "user", content: prompt }
            ],
            model: modelId,
            temperature: 0.5, 
            stream: false,
            response_format: { type: "json_object" } 
          })
        });

        // --- HANDLE RATE LIMIT (429) ---
        if (response.status === 429) {
           console.warn(`Groq Rate Limit (429) Batch ${batchNum}. Cooling down...`);
           // Backoff: 5s, 10s, 15s
           await new Promise(r => setTimeout(r, 5000 * attempts));
           continue; 
        }

        if (!response.ok) throw new Error(`Groq API Error: ${response.status}`);
        
        const json = await response.json();
        const content = json.choices[0]?.message?.content;
        
        let batchQs = [];
        try {
           const parsed = JSON.parse(content);
           if (Array.isArray(parsed)) batchQs = parsed;
           else if (parsed.questions) batchQs = parsed.questions;
           else if (parsed.data) batchQs = parsed.data;
           else batchQs = [parsed];
        } catch (e) {
           batchQs = extractAndParseJSON(content);
        }

        // VALIDASI HASIL
        if (batchQs.length > 0) {
           const validQuestions = batchQs
              .map(sanitizeQuestion)
              .filter(q => q !== null);
           
           if (validQuestions.length > 0) {
               allRawQuestions = [...allRawQuestions, ...validQuestions];
               success = true;
           } else {
               throw new Error("JSON valid tapi format soal salah.");
           }
        } else {
            throw new Error("JSON kosong.");
        }

      } catch (err) {
        console.warn(`Groq Batch ${batchNum} error:`, err);
        if (attempts < MAX_RETRIES) await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  if (allRawQuestions.length === 0) throw new Error("Gagal membuat soal. Coba kurangi jumlah soal atau ganti dokumen.");

  const finalQuestions = allRawQuestions.map((q, idx) => ({
    ...q,
    id: idx + 1
  }));

  return { questions: finalQuestions, contextText: contextMaterial };
};
