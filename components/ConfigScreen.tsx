
import React, { useState, useEffect } from 'react';
import { Upload, FileText, Layout, Zap, TrendingUp, Skull, BookOpen, Type, Cloud, RefreshCw, CheckCircle2, X, PlayCircle, Layers, Settings2, Sparkles, Folder, Target, BrainCircuit, Shuffle, Cpu, ChevronDown, MessageSquarePlus, Check } from 'lucide-react';
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

const BLOOM_LEVELS = [
  { id: ExamStyle.C1_RECALL, label: "C1: Mengingat", desc: "Hafalan & Definisi" },
  { id: ExamStyle.C2_CONCEPT, label: "C2: Memahami", desc: "Konsep Dasar" },
  { id: ExamStyle.C3_APPLICATION, label: "C3: Menerapkan", desc: "Studi Kasus" },
  { id: ExamStyle.C4_ANALYSIS, label: "C4: Menganalisis", desc: "Logika & Diagnosa" },
  { id: ExamStyle.C5_EVALUATION, label: "C5: Evaluasi", desc: "Kritik & Banding" },
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
  // Default to C2 Concept, array type now
  const [examStyles, setExamStyles] = useState<ExamStyle[]>([ExamStyle.C2_CONCEPT]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [enableRetention, setEnableRetention] = useState(false); 
  const [enableMixedTypes, setEnableMixedTypes] = useState(false);
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

  const handleProviderChange = (newProvider: AiProvider) => {
      setProvider(newProvider);
      // Auto-select first model of that provider to prevent mismatch
      const firstModel = dynamicModels.find(m => m.provider === newProvider) || AVAILABLE_MODELS.find(m => m.provider === newProvider);
      if (firstModel) setModelId(firstModel.id);
  };

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

  const toggleExamStyle = (style: ExamStyle) => {
    setExamStyles(prev => {
        if (prev.includes(style)) {
            // Prevent empty selection, keep at least one
            if (prev.length === 1) return prev;
            return prev.filter(s => s !== style);
        }
        return [...prev, style];
    });
  };

  const handleStart = () => {
    if (inputMethod === 'library' && selectedLibraryIds.length === 0) return alert("Pilih minimal 1 materi dari Library!");
    if (inputMethod === 'upload' && files.length === 0) return alert("Upload file dulu!");
    if (inputMethod === 'topic' && !topic.trim()) return alert("Isi topik dulu!");
    if (!topic && inputMethod === 'library') return alert("Isi 'Fokus Topik' agar AI tidak halusinasi!");

    setIsGenerating(true);
    
    let finalTopic = topic;
    let finalLibraryContext = "";

    if (inputMethod === 'library') {
       const selectedItems = libraryItems.filter(item => selectedLibraryIds.includes(String(item.id)));
       finalLibraryContext = selectedItems.map(item => `[SOURCE: ${item.title}]\n${item.processedContent || item.content}`).join("\n\n");
    }

    setTimeout(() => {
        onStart(inputMethod === 'upload' ? files : [], { 
          provider, modelId, questionCount, mode, 
          examStyle: examStyles, // Pass array
          topic: finalTopic, 
          customPrompt,
          libraryContext: finalLibraryContext,
          enableRetention,
          enableMixedTypes
        });
        setTimeout(() => setIsGenerating(false), 2000); 
    }, 100);
  };

  const isReady = (inputMethod === 'library' && selectedLibraryIds.length > 0 && topic.length > 2) || 
                  (inputMethod === 'upload' && files.length > 0) || 
                  (inputMethod === 'topic' && topic.trim().length > 3);

  // --- SEGMENTED CONTROL COMPONENT ---
  const InputTab = ({ id, icon: Icon, label }: { id: typeof inputMethod, icon: any, label: string }) => (
    <button 
        onClick={() => setInputMethod(id)} 
        className={`relative flex items-center justify-center space-x-2 px-6 py-3 rounded-xl transition-all z-10 ${inputMethod === id ? 'text-indigo-700 font-bold' : 'text-slate-500 font-medium hover:text-slate-700'}`}
    >
        {inputMethod === id && (
            <motion.div 
                layoutId="active-tab"
                className="absolute inset-0 bg-white shadow-md border border-indigo-100 rounded-xl"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
        )}
        <span className="relative z-10 flex items-center gap-2"><Icon size={18} /> {label}</span>
    </button>
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-24 text-theme-text">
      
      {/* HERO HEADER */}
      <div className="text-center space-y-2 pt-4">
        <motion.h1 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="text-6xl font-black tracking-tighter"
        >
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
                Mikir
            </span>
            <span className="font-light opacity-40 text-4xl ml-2 text-slate-400">( •_•)</span>
        </motion.h1>
      </div>

      <motion.div className="animate-breathe">
         <DashboardMascot onOpenScheduler={() => setIsSchedulerOpen(true)} />
      </motion.div>

      <AnimatePresence>
        {hasActiveSession && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="w-full">
            <button onClick={onContinue} className="btn-tactile w-full bg-emerald-500 border-emerald-600 text-white p-4 rounded-3xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-3 mb-4">
              <PlayCircle size={24} /> <span className="text-lg font-bold">Lanjutkan Quiz</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-[2.5rem] p-6 md:p-8 shadow-xl shadow-indigo-500/5 relative overflow-hidden">
        
        {/* SEGMENTED CONTROL FOR INPUT */}
        <div className="flex p-1.5 bg-slate-100/50 border border-slate-200/50 rounded-2xl mb-8 w-fit mx-auto shadow-inner">
          <InputTab id="library" icon={BookOpen} label="Library" />
          <InputTab id="upload" icon={Upload} label="Upload" />
          <InputTab id="topic" icon={Type} label="Manual" />
        </div>

        {/* --- MAIN INPUT AREA --- */}
        <div className="mb-8">
          <AnimatePresence mode='wait'>
            {inputMethod === 'library' && (
                <motion.div 
                    key="library"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                >
                    <div className="max-h-60 overflow-y-auto custom-scrollbar border border-white rounded-3xl bg-slate-50/50 p-3 shadow-inner">
                    {libraryItems.length === 0 ? (
                        <p className="text-center py-12 text-slate-400 text-sm font-medium">Library kosong. Upload materi di Workspace dulu.</p>
                    ) : (
                        libraryItems.map(item => (
                            <div key={item.id} onClick={() => toggleLibrarySelection(item.id)} className={`group flex items-center justify-between p-3 mb-2 rounded-2xl cursor-pointer transition-all border ${selectedLibraryIds.includes(String(item.id)) ? 'bg-white border-indigo-200 shadow-md translate-x-1' : 'bg-transparent border-transparent hover:bg-white/60 hover:shadow-sm'}`}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`p-2.5 rounded-xl transition-colors ${selectedLibraryIds.includes(String(item.id)) ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200/50 text-slate-400 group-hover:bg-white'}`}><FileText size={18} /></div>
                                <div className="min-w-0">
                                    <span className={`block text-sm font-bold truncate ${selectedLibraryIds.includes(String(item.id)) ? 'text-indigo-900' : 'text-slate-600'}`}>{item.title}</span>
                                    {item.processedContent && <span className="text-[9px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-bold flex w-fit items-center mt-0.5 gap-1"><Zap size={8} /> FAST</span>}
                                </div>
                                </div>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedLibraryIds.includes(String(item.id)) ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300 text-transparent'}`}>
                                    <CheckCircle2 size={14} />
                                </div>
                            </div>
                        ))
                    )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 px-2 font-medium">
                        <span>Terpilih: {selectedLibraryIds.length} materi</span>
                        <button onClick={() => window.location.hash = '#workspace'} className="text-indigo-600 hover:underline">Kelola Library &rarr;</button>
                    </div>
                </motion.div>
            )}

            {inputMethod === 'upload' && (
                <motion.div 
                    key="upload"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`relative group h-52 border-2 border-dashed rounded-[2rem] transition-all flex flex-col items-center justify-center text-center overflow-hidden p-8 ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'} cursor-pointer`} 
                    onDragEnter={(e)=>{e.preventDefault();setDragActive(true)}} 
                    onDragLeave={(e)=>{e.preventDefault();setDragActive(false)}} 
                    onDragOver={(e)=>{e.preventDefault();setDragActive(true)}} 
                    onDrop={e => {e.preventDefault(); handleFilesUpload(e.dataTransfer.files);}} 
                    onClick={() => document.getElementById('file-upload')?.click()}
                >
                    <input id="file-upload" type="file" multiple className="hidden" accept=".pdf,.md,.txt" onChange={(e) => handleFilesUpload(e.target.files)} />
                    {files.length > 0 ? (
                        <div className="w-full space-y-2">
                            {files.map((f,i) => (
                                <motion.div initial={{y:10, opacity:0}} animate={{y:0, opacity:1}} key={i} className="bg-white p-3 rounded-xl text-sm flex items-center justify-center text-indigo-700 shadow-sm border border-indigo-100 font-bold">
                                    <CheckCircle2 size={16} className="mr-2 text-emerald-500"/> {f.name}
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <>
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform"><Upload size={28} className="text-indigo-500" /></div>
                            <p className="font-bold text-slate-700">Klik atau Drop File PDF</p>
                            <p className="text-xs text-slate-400 mt-1">Otomatis dibaca AI</p>
                        </>
                    )}
                </motion.div>
            )}

            {inputMethod === 'topic' && (
                <motion.div key="topic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Paste materi kuliah, artikel, atau tulis topik spesifik di sini..." className="w-full h-52 bg-white border border-slate-200 rounded-[2rem] p-6 text-slate-700 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-inner resize-none transition-shadow" />
                </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* --- COMMON CONTROLS --- */}
        <div className="space-y-6">
           {(inputMethod === 'library' || inputMethod === 'upload') && (
              <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100">
                 <label className="flex items-center text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">
                    <Target size={14} className="mr-1" /> Fokus Topik (Wajib)
                 </label>
                 <input 
                   type="text" 
                   value={topic} 
                   onChange={(e) => setTopic(e.target.value)} 
                   placeholder="e.g. Bab 3 Fotosintesis..." 
                   className="w-full bg-transparent border-b-2 border-indigo-200 py-2 text-lg font-bold text-indigo-900 placeholder:text-indigo-300 focus:outline-none focus:border-indigo-500 transition-colors"
                 />
              </div>
           )}

           {/* --- AI BRAIN CONTROL --- */}
           <div className="bg-white/50 p-4 rounded-3xl border border-white shadow-sm flex flex-col md:flex-row gap-4 items-center">
              {/* Provider Switcher */}
              <div className="flex bg-slate-200/50 p-1.5 rounded-xl shrink-0">
                 <button 
                    onClick={() => handleProviderChange('gemini')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center transition-all ${provider === 'gemini' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                    <Zap size={14} className="mr-1.5" /> Gemini
                 </button>
                 <button 
                    onClick={() => handleProviderChange('groq')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center transition-all ${provider === 'groq' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                    <Cpu size={14} className="mr-1.5" /> Groq
                 </button>
              </div>

              {/* Model Dropdown */}
              <div className="relative flex-1 w-full">
                 <select 
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    disabled={isLoadingModels}
                    className="w-full appearance-none bg-white border border-slate-200 text-slate-700 font-bold text-sm rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
                 >
                    {dynamicModels.filter(m => m.provider === provider).map(m => (
                       <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                 </select>
                 <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    {isLoadingModels ? <RefreshCw className="animate-spin" size={14} /> : <ChevronDown size={14} />}
                 </div>
              </div>
           </div>

           {/* Mode Selection with Tactile Cards */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {MODE_CARDS.map((m) => (
                 <button 
                    key={m.id} 
                    onClick={() => setMode(m.id)} 
                    className={`
                        relative p-4 rounded-3xl text-left transition-all btn-tactile
                        ${mode === m.id 
                            ? `${m.color} bg-white border-b-4 shadow-lg scale-[1.02]` 
                            : 'bg-white border-slate-200 border-b-4 text-slate-400 hover:bg-slate-50 hover:border-slate-300'}
                    `}
                    style={{ borderColor: mode === m.id ? 'currentColor' : undefined }} // Use text color for active border
                 >
                    <div className="flex justify-between mb-2">
                        <m.icon size={24} /> 
                        {mode === m.id && <div className="bg-current rounded-full p-0.5"><CheckCircle2 size={14} className="text-white"/></div>}
                    </div>
                    <div className="font-bold text-sm">{m.label}</div>
                    <div className="text-[10px] opacity-70 font-medium">{m.desc}</div>
                 </button>
              ))}
           </div>

           {/* BLOOM LEVEL SELECTOR (MULTI-SELECT) */}
           <div className="bg-white/50 p-5 rounded-3xl border border-white shadow-sm">
                <label className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                    <TrendingUp size={14} className="mr-1.5" /> Level Kognitif (Bisa pilih &gt; 1)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {BLOOM_LEVELS.map(level => {
                        const isSelected = examStyles.includes(level.id);
                        return (
                            <button
                                key={level.id}
                                onClick={() => toggleExamStyle(level.id)}
                                className={`
                                    relative p-2 rounded-xl text-center transition-all 
                                    ${isSelected ? 'bg-indigo-600 text-white shadow-md transform scale-[1.02]' : 'bg-white border border-slate-200 text-slate-500 hover:bg-indigo-50'}
                                `}
                            >
                                {isSelected && (
                                    <div className="absolute top-1 right-1 bg-white text-indigo-600 rounded-full p-0.5">
                                        <Check size={8} strokeWidth={4} />
                                    </div>
                                )}
                                <div className="text-xs font-bold">{level.label.split(':')[0]}</div>
                                <div className={`text-[10px] ${isSelected ? 'opacity-90' : 'opacity-80'}`}>{level.desc}</div>
                            </button>
                        );
                    })}
                </div>
           </div>

           {/* CUSTOM PROMPT */}
           <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center text-xs font-bold text-indigo-500 hover:underline mx-auto">
                <Settings2 size={12} className="mr-1" /> {showAdvanced ? "Sembunyikan Opsi Tambahan" : "Tampilkan Opsi Tambahan (Prompt Khusus)"}
           </button>

           <AnimatePresence>
                {showAdvanced && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-4">
                        <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm">
                            <label className="flex items-center text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">
                                <MessageSquarePlus size={14} className="mr-1.5" /> Custom Instruksi
                            </label>
                            <textarea 
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                placeholder="Contoh: Buat soal yang lucu, fokus pada tanggal sejarah, atau gunakan bahasa gaul..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none h-24"
                            />
                        </div>

                        {/* --- TOGGLES --- */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button 
                                onClick={() => setEnableRetention(!enableRetention)}
                                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${enableRetention ? 'bg-indigo-50 border-indigo-200 shadow-inner' : 'bg-white border-transparent hover:border-slate-200'}`}
                            >
                                <div className="flex items-center">
                                    <div className={`p-2.5 rounded-xl mr-3 ${enableRetention ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        <BrainCircuit size={20} />
                                    </div>
                                    <div className="text-left">
                                        <span className={`block font-bold text-sm ${enableRetention ? 'text-indigo-900' : 'text-slate-600'}`}>Sticky Mode</span>
                                    </div>
                                </div>
                                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${enableRetention ? 'bg-indigo-500' : 'bg-slate-200'}`}><motion.div className="w-4 h-4 bg-white rounded-full shadow-sm" animate={{ x: enableRetention ? 16 : 0 }} /></div>
                            </button>

                            <button 
                                onClick={() => setEnableMixedTypes(!enableMixedTypes)}
                                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${enableMixedTypes ? 'bg-fuchsia-50 border-fuchsia-200 shadow-inner' : 'bg-white border-transparent hover:border-slate-200'}`}
                            >
                                <div className="flex items-center">
                                    <div className={`p-2.5 rounded-xl mr-3 ${enableMixedTypes ? 'bg-fuchsia-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        <Shuffle size={20} />
                                    </div>
                                    <div className="text-left">
                                        <span className={`block font-bold text-sm ${enableMixedTypes ? 'text-fuchsia-900' : 'text-slate-600'}`}>Variasi Soal</span>
                                    </div>
                                </div>
                                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${enableMixedTypes ? 'bg-fuchsia-500' : 'bg-slate-200'}`}><motion.div className="w-4 h-4 bg-white rounded-full shadow-sm" animate={{ x: enableMixedTypes ? 16 : 0 }} /></div>
                            </button>
                        </div>
                    </motion.div>
                )}
           </AnimatePresence>

           {/* SLIDER */}
           <div className="bg-white/50 p-5 rounded-3xl border border-white shadow-sm">
               <div className="flex justify-between items-center mb-4">
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Jumlah Soal</span>
                   <span className="text-xl font-black text-indigo-600">{questionCount}</span>
               </div>
               <input 
                 type="range" min="5" max="30" step="5" 
                 value={questionCount} 
                 onChange={(e) => setQuestionCount(parseInt(e.target.value))} 
                 className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500" 
               />
               <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-bold px-1">
                   <span>5</span><span>15</span><span>30</span>
               </div>
           </div>
        </div>

        <div className="mt-8">
           <button 
             onClick={handleStart} 
             disabled={!isReady || isGenerating} 
             className="btn-tactile w-full py-4 bg-slate-900 border-slate-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-slate-900/10 flex items-center justify-center hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {isGenerating ? <RefreshCw className="animate-spin mr-2" /> : <Sparkles className="mr-2 fill-yellow-400 text-yellow-400" />}
             {inputMethod === 'library' ? `Generate dari ${selectedLibraryIds.length} Materi` : 'Mulai Magic'}
           </button>
        </div>

      </motion.div>

      <StudyScheduler isOpen={isSchedulerOpen} onClose={() => setIsSchedulerOpen(false)} defaultTopic={topic} />
      <AnimatePresence>
        {isReviewing && <FlashcardScreen questions={dueCards} onClose={() => { setIsReviewing(false); setDueCards(getDueItems().map(i => i.question)); }} />}
      </AnimatePresence>
    </div>
  );
};
