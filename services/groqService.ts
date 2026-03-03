
/**
 * ==========================================
 * GROQ CLOUD SERVICE (SMART CHUNKING + RAG)
 * ==========================================
 */

import { Question, QuizMode, ExamStyle, ModelOption } from "../types";
import { processFilesToContext } from "./fileService";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";
const BATCH_SIZE = 5; 
const MAX_RETRIES = 3; 

export const fetchGroqModels = async (apiKey: string): Promise<ModelOption[]> => {
  try {
    const response = await fetch(GROQ_MODELS_URL, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) throw new Error("Gagal mengambil model Groq");

    const data = await response.json();
    
    // Transform Groq API response to ModelOption
    if (data && Array.isArray(data.data)) {
       return data.data
         .filter((m: any) => m && m.id && !m.id.includes('whisper')) // Exclude audio models & invalid
         .map((m: any) => ({
            id: m.id,
            label: m.id, // Use ID as label for now
            provider: 'groq',
            isVision: false 
         }))
         .sort((a: any, b: any) => a.id.localeCompare(b.id));
    }
    return [];
  } catch (error) {
    console.error("Groq Model Fetch Error:", error);
    return [];
  }
};

const extractAndParseJSON = (text: string): any[] => {
  if (!text) return [];
  
  console.log("Raw Groq Response (First 500 chars):", text.substring(0, 500));

  // 1. Clean Markdown
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  // 2. Try parsing the whole thing first (Best Case)
  try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object') {
          // Look for any array property (e.g. "questions": [...])
          if (Array.isArray(parsed.questions)) return parsed.questions;
          for (const key in parsed) {
              if (Array.isArray(parsed[key])) return parsed[key];
          }
          // If the object itself is a single question (rare), wrap it
          if (parsed.text && (parsed.options || parsed.choices)) return [parsed];
      }
  } catch (e) { /* continue to heuristic extraction */ }

  // 3. Heuristic Extraction of Array [...]
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  
  if (start !== -1 && end !== -1) {
      const jsonArrayStr = cleaned.substring(start, end + 1);
      try {
          return JSON.parse(jsonArrayStr);
      } catch (e) {
          // Try fixing trailing commas which Llama 3 sometimes leaves
          try {
             const fixed = jsonArrayStr.replace(/,\s*]/g, ']');
             return JSON.parse(fixed);
          } catch (e2) {}
      }
  }

  // 4. Heuristic Extraction of Object {...} containing array
  const startObj = cleaned.indexOf('{');
  const endObj = cleaned.lastIndexOf('}');
  if (startObj !== -1 && endObj !== -1) {
      try {
          const jsonObj = JSON.parse(cleaned.substring(startObj, endObj + 1));
          if (Array.isArray(jsonObj.questions)) return jsonObj.questions;
          for (const key in jsonObj) {
              if (Array.isArray(jsonObj[key])) return jsonObj[key];
          }
      } catch(e) {}
  }

  console.error("Groq JSON Parse Failed. Raw:", text);
  return [];
};

const sanitizeQuestion = (q: any): Question | null => {
  const qText = q.text || q.question || q.soal; 
  if (!qText || typeof qText !== 'string' || qText.length < 5) return null; 

  let options = Array.isArray(q.options) ? q.options : (q.choices || []);
  if (options.length < 2) return null;
  
  options = options.map(String).slice(0, 4);
  while(options.length < 4) options.push("-");
  
  let correctIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
  
  // Shuffle options
  const correctContent = options[correctIndex];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  
  return {
    id: 0,
    text: qText,
    options: options,
    correctIndex: options.indexOf(correctContent),
    explanation: q.explanation || "Pembahasan tidak tersedia.",
    hint: q.hint || "Coba ingat kembali konsep utamanya.",
    keyPoint: q.keyPoint || "Umum",
    difficulty: "Medium"
  };
};

export const generateQuizGroq = async (
  apiKey: string,
  files: File[] | File | null,
  topic: string | undefined,
  modelId: string,
  questionCount: number,
  mode: QuizMode,
  examStyles: ExamStyle[] = [ExamStyle.C2_CONCEPT],
  onProgress: (status: string) => void,
  existingQuestionsContext: string[] = [],
  customPrompt: string = "" 
): Promise<{ questions: Question[], contextText: string }> => {

  if (!apiKey) throw new Error("API Key Groq kosong.");

  let contextMaterial = "";
  
  // Normalize files
  const fileArray = Array.isArray(files) ? files : (files ? [files] : []);

  if (fileArray.length > 0) {
    contextMaterial = await processFilesToContext(fileArray, onProgress);
  } else {
    contextMaterial = topic || "";
  }

  // Safety Check: If context is too short, warn user (prevents hallucinations)
  if (contextMaterial.length < 50 && !topic) {
      throw new Error("Materi kosong atau tidak terbaca. Harap ketik topik manual atau cek file PDF.");
  }

  const bloomInstruction = examStyles.length > 0 
    ? `DIFFICULTY LEVELS (Mix these): ${examStyles.join(', ')}`
    : `DIFFICULTY: ${ExamStyle.C2_CONCEPT}`;

  const totalBatches = Math.ceil(questionCount / BATCH_SIZE);
  const chunkSize = Math.ceil(contextMaterial.length / totalBatches);
  
  const batchPromises: Promise<any[]>[] = [];

  for (let i = 0; i < totalBatches; i++) {
    const batchNum = i + 1;
    const needed = Math.min(BATCH_SIZE, questionCount - (i * BATCH_SIZE));
    
    if (needed <= 0) continue;

    const startIdx = i * chunkSize;
    const endIdx = Math.min((i + 1) * chunkSize, contextMaterial.length);
    const batchContext = contextMaterial.substring(Math.max(0, startIdx - 500), endIdx); 

    const generateBatch = async (): Promise<any[]> => {
        let attempts = 0;
        while (attempts < MAX_RETRIES) {
            attempts++;
            onProgress(`Groq: Meracik Paket Soal ${batchNum}/${totalBatches} (Parallel)...`);

            // SIMPLIFIED PROMPT FOR SPEED
            const prompt = `
                <context>
                ${batchContext.substring(0, 25000)}
                </context>

                <task>
                Create ${needed} multiple-choice questions in INDONESIAN based on <context>.
                Focus: ${topic || 'Main Concepts'}
                ${bloomInstruction}
                User Note: ${customPrompt || "None"}
                
                Format: JSON Object with "questions" array.
                Structure:
                - text: Question string
                - options: [A, B, C, D]
                - correctIndex: 0-3
                - explanation: Why correct + why others wrong.
                - hint: Socratic hint.
                - keyPoint: Topic tag.
                </task>
            `;

            try {
                const response = await fetch(GROQ_API_URL, {
                method: "POST",
                headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [
                    { 
                        role: "system", 
                        content: "You are a strict JSON exam generator. Output JSON only." 
                    },
                    { role: "user", content: prompt }
                    ],
                    model: modelId,
                    temperature: 0.3, 
                    stream: false,
                    response_format: { type: "json_object" } 
                })
                });

                if (response.status === 429) {
                    await new Promise(r => setTimeout(r, 3000));
                    continue; 
                }

                if (!response.ok) throw new Error(`Groq API Error: ${response.status}`);
                
                const json = await response.json();
                const content = json.choices[0]?.message?.content;
                const batchQs = extractAndParseJSON(content);

                if (batchQs.length > 0) {
                    const validQuestions = batchQs.map(sanitizeQuestion).filter(q => q !== null);
                    if (validQuestions.length > 0) {
                        return validQuestions;
                    }
                }
            } catch (err) {
                console.warn(`Batch ${batchNum} failed, retrying...`, err);
                if (attempts < MAX_RETRIES) await new Promise(r => setTimeout(r, 1000));
            }
        }
        return []; 
    };

    batchPromises.push(generateBatch());
  }

  let allRawQuestions: any[] = [];
  try {
      const results = await Promise.all(batchPromises);
      allRawQuestions = results.flat();
  } catch (e) {
      console.error("Groq Parallel Error", e);
      throw new Error("Gagal mengambil data dari Groq.");
  }

  if (allRawQuestions.length === 0) throw new Error("Gagal membuat soal. Dokumen mungkin tidak terbaca atau model sedang sibuk.");

  const finalQuestions = allRawQuestions.map((q, idx) => ({ ...q, id: idx + 1 }));
  return { questions: finalQuestions, contextText: contextMaterial };
};
