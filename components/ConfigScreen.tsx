import React, { useState, useMemo } from 'react';
import { Upload, FileText, Layout, Zap, TrendingUp, Skull, BookOpen, BrainCircuit, Briefcase, Target, Type, Cpu, Download, PlayCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AVAILABLE_MODELS, ModelConfig, QuizMode, ExamStyle, AiProvider } from '../types';
import { GlassButton } from './GlassButton';
import { DashboardMascot } from './DashboardMascot';
import { StudyScheduler } from './StudyScheduler';

interface ConfigScreenProps {
  onStart: (file: File | null, config: ModelConfig) => void;
  onImport: (file: File) => void;
  onContinue: () => void;
  hasActiveSession: boolean;
}

export const ConfigScreen: React.FC<ConfigScreenProps> = ({ onStart, onImport, onContinue, hasActiveSession }) => {
  // Input Method State: 'file' or 'topic'
  const [inputMethod, setInputMethod] = useState<'file' | 'topic'>('file');
  
  const [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState('');
  
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [modelId, setModelId] = useState(AVAILABLE_MODELS[0].id);
  const [questionCount, setQuestionCount] = useState(10);
  const [mode, setMode] = useState<QuizMode>(QuizMode.STANDARD);
  const [examStyle, setExamStyle] = useState<ExamStyle>(ExamStyle.CONCEPTUAL);
  const [dragActive, setDragActive] = useState(false);

  // Scheduler State
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);

  // Filter models based on selected provider
  const filteredModels = useMemo(() => {
    return AVAILABLE_MODELS.filter(m => m.provider === provider);
  }, [provider]);

  // Reset modelId when provider changes
  const handleProviderChange = (newProvider: AiProvider) => {
    setProvider(newProvider);
    const firstModel = AVAILABLE_MODELS.find(m => m.provider === newProvider);
    if (firstModel) setModelId(firstModel.id);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      // Check for JSON import via drag drop
      if (droppedFile.name.endsWith('.json') || droppedFile.name.endsWith('.glassquiz')) {
        onImport(droppedFile);
      } else {
        setFile(droppedFile);
        setInputMethod('file');
      }
    }
  };

  const handleChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImportClick = () => {
    document.getElementById('import-quiz-input')?.click();
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImport(e.target.files[0]);
    }
  };

  const handleStart = () => {
    // Validation
    if (inputMethod === 'file' && !file) return;
    if (inputMethod === 'topic' && !topic.trim()) return;

    onStart(
      inputMethod === 'file' ? file : null, 
      { provider, modelId, questionCount, mode, examStyle, topic: inputMethod === 'topic' ? topic : undefined }
    );
  };

  const isReady = (inputMethod === 'file' && file) || (inputMethod === 'topic' && topic.trim().length > 3);

  // Constants for UI (Modes & Styles omitted for brevity as they are unchanged)
  const modes = [
    { id: QuizMode.STANDARD, label: 'Standard', icon: <Layout size={20} />, info: "Santai, tanpa timer." },
    { id: QuizMode.SCAFFOLDING, label: 'Bertahap', icon: <TrendingUp size={20} />, info: "Mudah ke Sulit." },
    { id: QuizMode.TIME_RUSH, label: 'Cepat', icon: <Zap size={20} />, info: "20 detik/soal." },
    { id: QuizMode.SURVIVAL, label: 'Survival', icon: <Skull size={20} />, info: "3 nyawa saja." },
  ];

  const examStyles = [
    { id: ExamStyle.CONCEPTUAL, label: 'Konsep', icon: <BookOpen size={18} />, color: 'bg-emerald-50 text-emerald-700', info: "Hafalan & Definisi (C1-C2)" },
    { id: ExamStyle.ANALYTICAL, label: 'Analisa', icon: <BrainCircuit size={18} />, color: 'bg-indigo-50 text-indigo-700', info: "Logika & Sebab-Akibat (C4-C5)" },
    { id: ExamStyle.CASE_STUDY, label: 'Kasus', icon: <Briefcase size={18} />, color: 'bg-amber-50 text-amber-700', info: "Penerapan Situasi Nyata (C3)" },
    { id: ExamStyle.COMPETITIVE, label: 'Olimpiade', icon: <Target size={18} />, color: 'bg-rose-50 text-rose-700', info: "Soal Sulit & Pengecoh" },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-24">
      <div className="text-center space-y-2">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-bold text-slate-800 tracking-tighter"
        >
          Mikir <span className="font-light text-slate-400 text-4xl">( •_•)</span>
        </motion.h1>
      </div>

      <DashboardMascot onOpenScheduler={() => setIsSchedulerOpen(true)} />

      {/* CONTINUE ACTIVE SESSION BANNER */}
      <AnimatePresence>
        {hasActiveSession && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="w-full"
          >
            <button 
              onClick={onContinue}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-3xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-3 transition-all transform hover:scale-[1.02]"
            >
              <PlayCircle size={24} />
              <span className="text-lg font-bold">Lanjutkan Quiz yang Sedang Berjalan</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-white/30 backdrop-blur-xl border border-white/50 rounded-[2.5rem] p-6 md:p-10 shadow-2xl shadow-indigo-500/5 relative"
      >
        {/* Import Button (Top Right) */}
        <div className="absolute top-6 right-6 md:top-10 md:right-10">
          <button 
            onClick={handleImportClick}
            className="flex items-center space-x-2 text-xs font-medium text-slate-500 hover:text-indigo-600 bg-white/40 hover:bg-white px-3 py-2 rounded-xl border border-white/60 transition-all"
            title="Load .json / .glassquiz file"
          >
            <Download size={14} /> <span>Import Quiz</span>
          </button>
          <input 
            type="file" 
            id="import-quiz-input" 
            accept=".json,.glassquiz" 
            className="hidden" 
            onChange={handleImportFileChange}
          />
        </div>

        {/* INPUT METHOD TABS */}
        <div className="flex p-1 bg-white/40 rounded-2xl mb-8 w-fit mx-auto border border-white/50">
          <button 
            onClick={() => setInputMethod('file')}
            className={`flex items-center space-x-2 px-6 py-2 rounded-xl transition-all ${inputMethod === 'file' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Upload size={18} /> <span>Upload File</span>
          </button>
          <button 
            onClick={() => setInputMethod('topic')}
            className={`flex items-center space-x-2 px-6 py-2 rounded-xl transition-all ${inputMethod === 'topic' ? 'bg-white shadow-sm text-indigo-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Type size={18} /> <span>Tulis Topik</span>
          </button>
        </div>

        {/* DYNAMIC INPUT AREA */}
        <div className="mb-8 min-h-[160px]">
          {inputMethod === 'file' ? (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className={`
                relative group cursor-pointer h-40
                border-2 border-dashed rounded-3xl
                transition-all duration-300 ease-out
                flex flex-col items-center justify-center text-center
                ${dragActive ? 'border-indigo-500 bg-indigo-50/50' : file ? 'border-emerald-400/50 bg-emerald-50/30' : 'border-slate-300 hover:border-indigo-400 hover:bg-white/40'}
              `}
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <input id="file-upload" type="file" className="hidden" accept=".pdf,.md,.txt,.ppt,.pptx" onChange={handleChangeFile} />
              
              {file ? (
                <div className="flex items-center space-x-3 text-slate-800 font-medium">
                  <FileText size={28} className="text-emerald-600" />
                  <span>{file.name}</span>
                </div>
              ) : (
                <div className="text-slate-400">
                  <Upload size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Drag & drop materi pelajaran</p>
                  {provider === 'groq' && <p className="text-[10px] text-orange-500 mt-2">Note: Groq supports Text/MD files best</p>}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <textarea 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Contoh: Sejarah Revolusi Industri, Biologi Sel, atau Hukum Newton..."
                className="w-full h-40 bg-white/40 border-2 border-slate-200 rounded-3xl p-6 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white/60 resize-none transition-all text-lg"
              />
            </motion.div>
          )}
        </div>

        {/* SETTINGS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <div className="flex items-center mb-3 ml-1">
               <label className="text-sm font-medium text-slate-700">Mode Quiz</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {modes.map(m => (
                <button 
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`
                    w-full p-4 rounded-xl border flex flex-col items-start transition-all text-left h-full
                    ${mode === m.id 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                      : 'bg-white/30 border-transparent text-slate-500 hover:bg-white/50'}
                  `}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    {m.icon} 
                    <span className="text-sm font-semibold">{m.label}</span>
                  </div>
                  <span className={`text-xs leading-tight ${mode === m.id ? 'text-indigo-600/80' : 'text-slate-400'}`}>
                    {m.info}
                  </span>
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <div className="flex items-center mb-3 ml-1">
               <label className="text-sm font-medium text-slate-700">Fokus Soal</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {examStyles.map(s => (
                <button 
                  key={s.id}
                  onClick={() => setExamStyle(s.id)}
                  className={`
                    w-full p-4 rounded-xl border flex flex-col items-start transition-all text-left h-full
                    ${examStyle === s.id 
                      ? `${s.color} border-current shadow-sm` 
                      : 'bg-white/30 border-transparent text-slate-500 hover:bg-white/50'}
                  `}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    {s.icon} 
                    <span className="text-sm font-semibold">{s.label}</span>
                  </div>
                   <span className={`text-xs leading-tight opacity-80`}>
                    {s.info}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SLIDERS & PROVIDER */}
        <div className="space-y-6 mb-8">
           <div className="space-y-3">
             <div className="flex justify-between text-sm text-slate-600 font-medium">
               <span>Jumlah Soal</span> <span>{questionCount}</span>
             </div>
             <input type="range" min="5" max="50" step="5" value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
           </div>
           
           <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <label className="text-sm font-medium text-slate-700 ml-1">AI Provider</label>
                 <div className="flex bg-white/40 rounded-xl p-1 border border-slate-200">
                    <button onClick={() => handleProviderChange('gemini')} className={`flex-1 py-2 text-sm rounded-lg flex items-center justify-center transition-all ${provider === 'gemini' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-500'}`}>
                       <Zap size={14} className="mr-1" /> Gemini
                    </button>
                    <button onClick={() => handleProviderChange('groq')} className={`flex-1 py-2 text-sm rounded-lg flex items-center justify-center transition-all ${provider === 'groq' ? 'bg-white shadow-sm text-orange-600 font-bold' : 'text-slate-500'}`}>
                       <Cpu size={14} className="mr-1" /> Groq
                    </button>
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-sm font-medium text-slate-700 ml-1">Model</label>
                 <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="w-full bg-white/50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-indigo-300">
                   {filteredModels.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                 </select>
              </div>
           </div>
        </div>

        <GlassButton fullWidth onClick={handleStart} disabled={!isReady}>
          {inputMethod === 'file' ? 'Analisis Dokumen & Buat Soal' : 'Generate Soal dari Topik'}
        </GlassButton>

      </motion.div>

      {/* Scheduler Modal */}
      <StudyScheduler 
        isOpen={isSchedulerOpen} 
        onClose={() => setIsSchedulerOpen(false)} 
        defaultTopic={inputMethod === 'topic' ? topic : file?.name}
      />
    </div>
  );
};