
import React, { useState, useEffect } from 'react';
import { Upload, FileText, Layout, Zap, TrendingUp, Skull, BookOpen, Type, Cloud, RefreshCw, CheckCircle2, X, PlayCircle, Layers, Settings2, Sparkles, Folder, Target, BrainCircuit, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AVAILABLE_MODELS, ModelConfig, QuizMode, ExamStyle, AiProvider, CloudNote, Question, LibraryItem, ModelOption } from '../types';
import { GlassButton } from './GlassButton';
import { DashboardMascot } from './DashboardMascot';
import { StudyScheduler } from './StudyScheduler';
import { fetchNotesFromSupabase, getLibraryItems, getApiKey } from '../services/storageService';
import { fetchGroqModels } from '../services/groqService';
import { getDueItems } from '../services/srsService';
import { notifyReviewDue } from '../services/kaomojiNotificationService';
import { FlashcardScreen } from './FlashcardScreen';

interface ConfigScreenProps {
  onStart: (files: File[], config: ModelConfig) => void;
  onContinue: () => void;
  hasActiveSession: boolean;
}

const MODE_CARDS = [
  { id: QuizMode.STANDARD, icon: Layout, label: "Standard", desc: "Santai. Tanpa waktu.", color: "bg-indigo-50 border-indigo-200 text-indigo-600" },
  { id: QuizMode.TIME_RUSH, icon: Zap, label: "Time Rush", desc: "20 detik/soal.", color: "bg-amber-50 border-amber-200 text-amber-600" },
  { id: QuizMode.SURVIVAL, icon: Skull, label: "Survival", desc: "3 Nyawa.", color: "bg-rose-50 border-rose-200 text-rose-600" }
];

export const ConfigScreen: React.FC<ConfigScreenProps> = ({ onStart, onContinue, hasActiveSession }) => {
  const [inputMethod, setInputMethod] = useState<'library' | 'upload' | 'topic'>('library');
  
  // Library State
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<string[]>([]);
  
  // Direct Upload State
  const [files, setFiles] = useState<File[]>([]);
  
  // Manual Topic State
  const [topic, setTopic] = useState(''); 
  
  // Config State
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [modelId, setModelId] = useState(AVAILABLE_MODELS[0].id);
  const [dynamicModels, setDynamicModels] = useState<ModelOption[]>(AVAILABLE_MODELS);
  const [questionCount, setQuestionCount] = useState(10);
  const [mode, setMode] = useState<QuizMode>(QuizMode.STANDARD);
  const [examStyle, setExamStyle] = useState<ExamStyle>(ExamStyle.CONCEPTUAL);
  const [customPrompt, setCustomPrompt] = useState('');
  const [enableRetention, setEnableRetention] = useState(false); 
  const [enableMixedTypes, setEnableMixedTypes] = useState(false); // NEW FEATURE 5
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // UI State
  const [dragActive, setDragActive] = useState(false);
  const [dueCards, setDueCards] = useState<Question[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    getLibraryItems().then(setLibraryItems);
    const dueItems = getDueItems();
    if (dueItems.length > 0) {
      setDueCards(dueItems.map(item => item.question));
      notifyReviewDue(dueItems.length);
    }
  }, []);

  // --- DYNAMIC MODEL FETCHING ---
  useEffect(() => {
    const loadModels = async () => {
      if (provider === 'groq') {
        const apiKey = getApiKey('groq');
        if (apiKey) {
          setIsLoadingModels(true);
          const groqModels = await fetchGroqModels(apiKey);
          // Merge with default Gemini models
          const geminiModels = AVAILABLE_MODELS.filter(m => m.provider === 'gemini');
          // If fetch fails, keep defaults
          if (groqModels.length > 0) {
             setDynamicModels([...geminiModels, ...groqModels]);
             // Reset selection if current model isn't in new list
             if (!groqModels.find(m => m.id === modelId)) {
                setModelId(groqModels[0].id);
             }
          } else {
             setDynamicModels(AVAILABLE_MODELS);
          }
          setIsLoadingModels(false);
        }
      } else {
        // Reset to defaults for Gemini
        setDynamicModels(AVAILABLE_MODELS);
        if (!AVAILABLE_MODELS.find(m => m.id === modelId && m.provider === 'gemini')) {
           setModelId(AVAILABLE_MODELS[0].id);
        }
      }
    };
    loadModels();
  }, [provider]);

  const handleFilesUpload = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const validFiles = Array.from(newFiles).filter(f => f.name.endsWith('.pdf') || f.name.endsWith('.txt') || f.name.endsWith('.md'));
    setFiles(prev => [...prev, ...validFiles]);
    if (validFiles.length > 0 && !topic) {
       setTopic(validFiles[0].name.replace(/\.[^/.]+$/, ""));
    }
  };

  const toggleLibrarySelection = (id: string | number) => {
    const sid = String(id);
    setSelectedLibraryIds(prev => prev.includes(sid) ? prev.filter(i => i !== sid) : [...prev, sid]);
  };

  const handleStart = () => {
    // Validation
    if (inputMethod === 'library' && selectedLibraryIds.length === 0) return alert("Pilih minimal 1 materi dari Library!");
    if (inputMethod === 'upload' && files.length === 0) return alert("Upload file dulu!");
    if (inputMethod === 'topic' && !topic.trim()) return alert("Isi topik dulu!");
    if (!topic && inputMethod === 'library') return alert("Isi 'Fokus Topik' agar AI tidak halusinasi!");

    setIsGenerating(true);
    
    // Construct Payload
    let finalTopic = topic;
    let finalLibraryContext = "";

    // If using Library, aggregate text
    if (inputMethod === 'library') {
       const selectedItems = libraryItems.filter(item => selectedLibraryIds.includes(String(item.id)));
       finalLibraryContext = selectedItems.map(item => `[SOURCE: ${item.title}]\n${item.content}`).join("\n\n");
    }

    setTimeout(() => {
        onStart(inputMethod === 'upload' ? files : [], { 
          provider, modelId, questionCount, mode, examStyle, 
          topic: finalTopic, 
          customPrompt,
          libraryContext: finalLibraryContext,
          enableRetention,
          enableMixedTypes // Pass new flag
        });
        setTimeout(() => setIsGenerating(false), 2000); 
    }, 100);
  };

  const isReady = (inputMethod === 'library' && selectedLibraryIds.length > 0 && topic.length > 2) || 
                  (inputMethod === 'upload' && files.length > 0) || 
                  (inputMethod === 'topic' && topic.trim().length > 3);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-24 text-theme-text">
      <div className="text-center space-y-2">
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-5xl font-bold tracking-tighter">Mikir <span className="font-light opacity-50 text-4xl">( •_•)</span></motion.h1>
      </div>

      <DashboardMascot onOpenScheduler={() => setIsSchedulerOpen(true)} />

      <AnimatePresence>
        {hasActiveSession && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="w-full">
            <button onClick={onContinue} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-3xl shadow-lg flex items-center justify-center space-x-3">
              <PlayCircle size={24} /> <span className="text-lg font-bold">Lanjutkan Quiz</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-theme-glass border border-theme-border rounded-[2.5rem] p-6 md:p-8 shadow-xl relative">
        
        {/* INPUT TABS */}
        <div className="flex p-1 bg-theme-bg rounded-2xl mb-8 w-fit mx-auto border border-theme-border justify-center shadow-sm">
          <button onClick={() => setInputMethod('library')} className={`flex items-center space-x-2 px-6 py-2 rounded-xl transition-all ${inputMethod === 'library' ? 'bg-theme-primary text-white shadow-md font-bold' : 'text-theme-muted hover:bg-theme-glass'}`}><BookOpen size={18} /> <span>Library</span></button>
          <button onClick={() => setInputMethod('upload')} className={`flex items-center space-x-2 px-6 py-2 rounded-xl transition-all ${inputMethod === 'upload' ? 'bg-theme-primary text-white shadow-md font-bold' : 'text-theme-muted hover:bg-theme-glass'}`}><Upload size={18} /> <span>Upload</span></button>
          <button onClick={() => setInputMethod('topic')} className={`flex items-center space-x-2 px-6 py-2 rounded-xl transition-all ${inputMethod === 'topic' ? 'bg-theme-primary text-white shadow-md font-bold' : 'text-theme-muted hover:bg-theme-glass'}`}><Type size={18} /> <span>Manual</span></button>
        </div>

        {/* --- MAIN INPUT AREA --- */}
        <div className="mb-8">
          {inputMethod === 'library' && (
             <div className="space-y-4">
                <div className="max-h-60 overflow-y-auto custom-scrollbar border border-theme-border rounded-2xl bg-white/40 p-2">
                   {libraryItems.length === 0 ? (
                      <p className="text-center py-8 text-slate-400 text-sm">Library kosong. Upload materi di Workspace dulu.</p>
                   ) : (
                      libraryItems.map(item => (
                         <div key={item.id} onClick={() => toggleLibrarySelection(item.id)} className={`flex items-center justify-between p-3 mb-1 rounded-xl cursor-pointer transition-all border ${selectedLibraryIds.includes(String(item.id)) ? 'bg-indigo-50 border-indigo-300 shadow-sm' : 'border-transparent hover:bg-white/60'}`}>
                            <div className="flex items-center gap-3 overflow-hidden">
                               <div className={`p-2 rounded-lg ${selectedLibraryIds.includes(String(item.id)) ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}><FileText size={16} /></div>
                               <span className={`text-sm font-medium truncate ${selectedLibraryIds.includes(String(item.id)) ? 'text-indigo-800' : 'text-slate-600'}`}>{item.title}</span>
                            </div>
                            {selectedLibraryIds.includes(String(item.id)) && <CheckCircle2 size={18} className="text-indigo-500" />}
                         </div>
                      ))
                   )}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 px-2">
                   <span>Terpilih: {selectedLibraryIds.length} materi</span>
                   <button onClick={() => window.location.hash = '#workspace'} className="text-indigo-500 hover:underline">Kelola Library</button>
                </div>
             </div>
          )}

          {inputMethod === 'upload' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`relative group h-48 border-2 border-dashed rounded-3xl transition-all flex flex-col items-center justify-center text-center overflow-hidden p-8 ${dragActive ? 'border-theme-primary bg-theme-primary/10' : 'border-theme-border hover:border-theme-primary hover:bg-theme-bg/20'} cursor-pointer`} onDragEnter={(e)=>{e.preventDefault();setDragActive(true)}} onDragLeave={(e)=>{e.preventDefault();setDragActive(false)}} onDragOver={(e)=>{e.preventDefault();setDragActive(true)}} onDrop={e => {e.preventDefault(); handleFilesUpload(e.dataTransfer.files);}} onClick={() => document.getElementById('file-upload')?.click()}>
               <input id="file-upload" type="file" multiple className="hidden" accept=".pdf,.md,.txt" onChange={(e) => handleFilesUpload(e.target.files)} />
               {files.length > 0 ? (
                  <div className="w-full space-y-2">
                     {files.map((f,i) => <div key={i} className="bg-white/80 p-2 rounded-lg text-sm flex items-center justify-center text-indigo-700 shadow-sm"><CheckCircle2 size={14} className="mr-2"/> {f.name}</div>)}
                  </div>
               ) : (
                  <>
                    <Upload size={32} className="text-theme-primary mb-3" />
                    <p className="font-bold text-theme-text">Klik atau Drop File PDF</p>
                  </>
               )}
            </motion.div>
          )}

          {inputMethod === 'topic' && (
             <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tulis topik atau paste materi di sini..." className="w-full h-48 bg-theme-bg/50 border-2 border-theme-border rounded-3xl p-6 text-theme-text text-lg focus:outline-none focus:border-theme-primary" />
          )}
        </div>

        {/* --- COMMON CONTROLS --- */}
        <div className="space-y-6">
           {(inputMethod === 'library' || inputMethod === 'upload') && (
              <div className="bg-white/40 p-4 rounded-2xl border border-theme-border">
                 <label className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    <Target size={14} className="mr-1" /> Fokus Topik (Wajib)
                 </label>
                 <input 
                   type="text" 
                   value={topic} 
                   onChange={(e) => setTopic(e.target.value)} 
                   placeholder="Contoh: Bab 3 Fotosintesis, Sejarah PD II..." 
                   className="w-full bg-transparent border-b border-slate-300 py-2 text-lg font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
                 />
                 <p className="text-[10px] text-slate-400 mt-1">AI akan menggunakan materi di atas, TAPI hanya fokus membuat soal tentang topik ini.</p>
              </div>
           )}

           <div className="bg-theme-bg/30 p-4 rounded-2xl border border-theme-border">
              <div className="flex gap-2 mb-3">
                 <button onClick={() => setProvider('gemini')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${provider === 'gemini' ? 'bg-indigo-500 text-white shadow-md' : 'bg-white/50 text-slate-500'}`}>Gemini</button>
                 <button onClick={() => setProvider('groq')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${provider === 'groq' ? 'bg-orange-500 text-white shadow-md' : 'bg-white/50 text-slate-500'}`}>Groq</button>
              </div>
              
              {isLoadingModels ? (
                 <div className="py-2 text-center text-xs text-slate-400"><RefreshCw className="animate-spin inline mr-2" size={12}/> Loading Models...</div>
              ) : (
                 <select 
                   value={modelId} 
                   onChange={(e) => setModelId(e.target.value)} 
                   className="w-full bg-white/70 border border-slate-200 text-slate-800 text-sm rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                 >
                    {dynamicModels.filter(m => m.provider === provider).map(m => (
                       <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                 </select>
              )}
           </div>

           {/* Mode Selection */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {MODE_CARDS.map((m) => (
                 <button key={m.id} onClick={() => setMode(m.id)} className={`relative p-3 rounded-2xl border-2 text-left transition-all ${mode === m.id ? `${m.color} bg-white shadow-md` : 'bg-transparent border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
                    <div className="flex justify-between mb-1"><m.icon size={20} /> {mode === m.id && <CheckCircle2 size={16}/>}</div>
                    <div className="font-bold text-sm">{m.label}</div>
                    <div className="text-[10px] opacity-70">{m.desc}</div>
                 </button>
              ))}
           </div>

           {/* --- STICKY QUIZ TOGGLE --- */}
           <button 
             onClick={() => setEnableRetention(!enableRetention)}
             className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${enableRetention ? 'bg-indigo-50 border-indigo-300' : 'bg-theme-bg/30 border-theme-border'}`}
           >
              <div className="flex items-center">
                 <div className={`p-2 rounded-lg mr-3 ${enableRetention ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    <BrainCircuit size={20} />
                 </div>
                 <div className="text-left">
                    <span className={`block font-bold text-sm ${enableRetention ? 'text-indigo-800' : 'text-slate-500'}`}>Mode "Lengket" (Sticky)</span>
                    <span className="text-[10px] text-slate-400">Ulang otomatis soal acak biar nempel.</span>
                 </div>
              </div>
              <div className={`w-10 h-6 rounded-full p-1 transition-colors ${enableRetention ? 'bg-indigo-500' : 'bg-slate-300'}`}><motion.div className="w-4 h-4 bg-white rounded-full shadow-sm" animate={{ x: enableRetention ? 16 : 0 }} /></div>
           </button>

           {/* --- FEATURE 5: MIXED TYPES TOGGLE --- */}
           <button 
             onClick={() => setEnableMixedTypes(!enableMixedTypes)}
             className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${enableMixedTypes ? 'bg-violet-50 border-violet-300' : 'bg-theme-bg/30 border-theme-border'}`}
           >
              <div className="flex items-center">
                 <div className={`p-2 rounded-lg mr-3 ${enableMixedTypes ? 'bg-violet-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    <Shuffle size={20} />
                 </div>
                 <div className="text-left">
                    <span className={`block font-bold text-sm ${enableMixedTypes ? 'text-violet-800' : 'text-slate-500'}`}>Variasi Soal (True/False & Isian)</span>
                    <span className="text-[10px] text-slate-400">Campur Pilihan Ganda dengan Benar/Salah dan Isian Singkat.</span>
                 </div>
              </div>
              <div className={`w-10 h-6 rounded-full p-1 transition-colors ${enableMixedTypes ? 'bg-violet-500' : 'bg-slate-300'}`}><motion.div className="w-4 h-4 bg-white rounded-full shadow-sm" animate={{ x: enableMixedTypes ? 16 : 0 }} /></div>
           </button>

           <div className="bg-theme-bg/30 p-4 rounded-2xl border border-theme-border flex items-center justify-between">
               <span className="text-sm font-bold text-theme-text">Jumlah Soal Dasar: {questionCount}</span>
               <input type="range" min="5" max="30" step="5" value={questionCount} onChange={(e) => setQuestionCount(parseInt(e.target.value))} className="w-32 accent-theme-primary" />
           </div>
        </div>

        {/* Advanced Toggle */}
        <div className="mb-4 text-center">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)} 
              className="flex items-center justify-center gap-2 text-xs font-bold text-theme-muted hover:text-theme-primary transition-colors mx-auto"
            >
               <Settings2 size={14} /> {showAdvanced ? "Sembunyikan Opsi" : "Opsi Lanjutan"}
            </button>
            
            <AnimatePresence>
               {showAdvanced && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden text-left mt-2">
                     <div className="bg-theme-bg/30 p-4 rounded-2xl border border-theme-border">
                        <div className="flex items-center gap-2 mb-2 text-theme-primary">
                           <Sparkles size={14} /> <span className="text-xs font-bold uppercase">Instruksi Khusus AI</span>
                        </div>
                        <textarea 
                          value={customPrompt} 
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          placeholder="Contoh: Fokus pada tanggal dan tokoh penting, buat soal yang menjebak..." 
                          className="w-full h-20 bg-white/50 border border-theme-border rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-theme-primary resize-none"
                        />
                     </div>
                  </motion.div>
               )}
            </AnimatePresence>
        </div>

        <div className="mt-8">
           <GlassButton fullWidth onClick={handleStart} disabled={!isReady || isGenerating} isLoading={isGenerating}>
             {inputMethod === 'library' ? `Generate Quiz dari ${selectedLibraryIds.length} Materi` : 'Mulai Magic'}
           </GlassButton>
        </div>

      </motion.div>

      <StudyScheduler isOpen={isSchedulerOpen} onClose={() => setIsSchedulerOpen(false)} defaultTopic={topic} />
      <AnimatePresence>
        {isReviewing && <FlashcardScreen questions={dueCards} onClose={() => { setIsReviewing(false); setDueCards(getDueItems().map(i => i.question)); }} />}
      </AnimatePresence>
    </div>
  );
};
