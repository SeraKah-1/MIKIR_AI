
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
         .filter((m: any) => !m.id.includes('whisper')) // Exclude audio models
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
  // 1. Clean Markdown
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  // 2. Try parsing the whole thing first
  try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object') {
          // Look for any array property (e.g. "questions": [...])
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
          for (const key in jsonObj) {
              if (Array.isArray(jsonObj[key])) return jsonObj[key];
          }
      } catch(e) {}
  }

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
  let allRawQuestions: any[] = [];
  const chunkSize = Math.ceil(contextMaterial.length / totalBatches);

  for (let i = 0; i < totalBatches; i++) {
    const batchNum = i + 1;
    const needed = Math.min(BATCH_SIZE, questionCount - allRawQuestions.length);
    if (needed <= 0) break;

    const startIdx = i * chunkSize;
    const endIdx = Math.min((i + 1) * chunkSize, contextMaterial.length);
    const batchContext = contextMaterial.substring(Math.max(0, startIdx - 500), endIdx); 

    let success = false;
    let attempts = 0;

    while (!success && attempts < MAX_RETRIES) {
      attempts++;
      onProgress(`Groq: Meracik Paket Soal ${batchNum}/${totalBatches}...`);

      // STRICT PROMPT ENGINEERING FOR LLAMA-3 / MIXTRAL
      // We use XML tags to clearly separate Instructions from Data.
      // Updated Output Format to prefer Object Wrapper for json_object mode stability.
      const prompt = `
        <context_material>
        ${batchContext.substring(0, 15000)}
        </context_material>

        <instructions>
        You are an exam generator. Your task is to create ${needed} multiple-choice questions in INDONESIAN language.
        
        CRITICAL RULES:
        1. SOURCE OF TRUTH: You must ONLY use the text inside <context_material> tags. Do NOT use outside knowledge.
        2. If the <context_material> is empty or unrelated, return an empty JSON array [].
        3. IGNORE metadata like page numbers, headers, or footers.
        4. FOCUS: ${topic ? `Focus specifically on: ${topic}` : 'Cover the main concepts found in the text.'}
        5. ${bloomInstruction}
        6. USER NOTE: ${customPrompt || "None"}
        7. SOCRATIC HINT: Provide a 'hint' that guides the user to the answer without giving it away directly.
        
        OUTPUT FORMAT (JSON OBJECT):
        {
          "questions": [
            {
              "text": "Question text here?",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correctIndex": 0,
              "explanation": "Brief explanation why A is correct based on the text.",
              "hint": "Socratic hint to help the user...",
              "keyPoint": "Topic Tag"
            }
          ]
        }
        </instructions>
      `;

      try {
        const response = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { 
                  role: "system", 
                  content: "You are a strict JSON-only API. You extract educational questions from provided text. You never hallucinate facts not present in the source." 
              },
              { role: "user", content: prompt }
            ],
            model: modelId,
            temperature: 0.3, // Lower temperature for more factual results
            stream: false,
            response_format: { type: "json_object" } 
          })
        });

        if (response.status === 429) {
           await new Promise(r => setTimeout(r, 4000));
           continue; 
        }

        if (!response.ok) throw new Error(`Groq API Error: ${response.status}`);
        
        const json = await response.json();
        const content = json.choices[0]?.message?.content;
        const batchQs = extractAndParseJSON(content);

        if (batchQs.length > 0) {
           const validQuestions = batchQs.map(sanitizeQuestion).filter(q => q !== null);
           if (validQuestions.length > 0) {
               allRawQuestions = [...allRawQuestions, ...validQuestions];
               success = true;
           }
        }
      } catch (err) {
        console.warn("Batch failed, retrying...", err);
        if (attempts < MAX_RETRIES) await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  if (allRawQuestions.length === 0) throw new Error("Gagal membuat soal. Dokumen mungkin tidak terbaca atau model sedang sibuk.");

  const finalQuestions = allRawQuestions.map((q, idx) => ({ ...q, id: idx + 1 }));
  return { questions: finalQuestions, contextText: contextMaterial };
};
