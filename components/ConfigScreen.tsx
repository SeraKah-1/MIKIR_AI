
import React, { useState, useMemo, useEffect } from 'react';
import { Upload, FileText, Layout, Zap, TrendingUp, Skull, BookOpen, BrainCircuit, Briefcase, Target, Type, Cpu, Cloud, RefreshCw, Layers, X, Edit3, PlayCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AVAILABLE_MODELS, ModelConfig, QuizMode, ExamStyle, AiProvider, CloudNote, Question } from '../types';
import { GlassButton } from './GlassButton';
import { DashboardMascot } from './DashboardMascot';
import { StudyScheduler } from './StudyScheduler';
import { fetchNotesFromSupabase, getSupabaseConfig } from '../services/storageService';
import { getDueItems } from '../services/srsService';
import { notifyReviewDue } from '../services/kaomojiNotificationService';
import { FlashcardScreen } from './FlashcardScreen';

interface ConfigScreenProps {
  onStart: (file: File | null, config: ModelConfig) => void;
  onContinue: () => void;
  hasActiveSession: boolean;
}

export const ConfigScreen: React.FC<ConfigScreenProps> = ({ onStart, onContinue, hasActiveSession }) => {
  const [inputMethod, setInputMethod] = useState<'file' | 'topic' | 'cloud'>('file');
  const [file, setFile] = useState<File | null>(null);
  
  // Topic state is now used for ALL modes as the "Quiz Title/Focus"
  const [topic, setTopic] = useState(''); 
  
  const [cloudNotes, setCloudNotes] = useState<CloudNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<CloudNote | null>(null);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [modelId, setModelId] = useState(AVAILABLE_MODELS[0].id);
  const [questionCount, setQuestionCount] = useState(10);
  const [mode, setMode] = useState<QuizMode>(QuizMode.STANDARD);
  const [examStyle, setExamStyle] = useState<ExamStyle>(ExamStyle.CONCEPTUAL);
  const [dragActive, setDragActive] = useState(false);
  const [dueCards, setDueCards] = useState<Question[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);

  useEffect(() => {
    const dueItems = getDueItems();
    if (dueItems.length > 0) {
      setDueCards(dueItems.map(item => item.question));
      notifyReviewDue(dueItems.length);
    }
  }, []);

  const filteredModels = useMemo(() => {
    return AVAILABLE_MODELS.filter(m => m.provider === provider);
  }, [provider]);

  const handleProviderChange = (newProvider: AiProvider) => {
    setProvider(newProvider);
    const firstModel = AVAILABLE_MODELS.find(m => m.provider === newProvider);
    if (firstModel) setModelId(firstModel.id);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      setInputMethod('file');
      // Auto-fill topic with filename for convenience, but user can edit
      setTopic(droppedFile.name.replace(/\.[^/.]+$/, "")); 
    }
  };

  const handleChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
       const f = e.target.files[0];
       setFile(f);
       setTopic(f.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleFetchNotes = async () => {
    const sbConfig = getSupabaseConfig();
    if (!sbConfig) {
      alert("Supabase belum dikonfigurasi. Pergi ke Settings > Storage > Supabase.");
      return;
    }
    setIsLoadingNotes(true);
    const notes = await fetchNotesFromSupabase();
    setCloudNotes(notes);
    setIsLoadingNotes(false);
    if (notes.length === 0) alert("Tidak ada catatan ditemukan.");
  };

  const handleSelectNote = (note: CloudNote) => {
    setSelectedNote(note);
    // Pre-fill the topic input with the note title, allowing user to edit it
    setTopic(note.title); 
  };

  const handleStart = () => {
    // Validation
    if (inputMethod === 'file' && !file) return;
    if (inputMethod === 'topic' && !topic.trim()) return;
    if (inputMethod === 'cloud' && !selectedNote) return;

    let finalTopicPrompt = topic;

    // Logic Construction based on Input Method
    if (inputMethod === 'cloud' && selectedNote) {
       // Combine User's Title + Note Content
       finalTopicPrompt = `Fokus Topik: ${topic}\n\nReferensi Materi:\n${selectedNote.content}`;
    } 
    
    onStart(
      inputMethod === 'file' ? file : null, 
      { 
        provider, 
        modelId, 
        questionCount, 
        mode, 
        examStyle, 
        topic: finalTopicPrompt // This is what gets sent to AI
      }
    );
  };

  // Check if ready to start
  const isReady = 
    (inputMethod === 'file' && file) || 
    (inputMethod === 'topic' && topic.trim().length > 3) || 
    (inputMethod === 'cloud' && selectedNote && topic.trim().length > 0);

  const modes = [
    { id: QuizMode.STANDARD, label: 'Standard', icon: <Layout size={20} />, info: "Santai, tanpa timer." },
    { id: QuizMode.SCAFFOLDING, label: 'Bertahap', icon: <TrendingUp size={20} />, info: "Mudah ke Sulit." },
    { id: QuizMode.TIME_RUSH, label: 'Cepat', icon: <Zap size={20} />, info: "20 detik/soal." },
    { id: QuizMode.SURVIVAL, label: 'Survival', icon: <Skull size={20} />, info: "3 nyawa saja." },
  ];

  const examStyles = [
    { id: ExamStyle.CONCEPTUAL, label: 'Konsep', icon: <BookOpen size={18} />, color: 'text-emerald-500', info: "Hafalan & Definisi" },
    { id: ExamStyle.ANALYTICAL, label: 'Analisa', icon: <BrainCircuit size={18} />, color: 'text-indigo-500', info: "Logika & Sebab-Akibat" },
    { id: ExamStyle.CASE_STUDY, label: 'Kasus', icon: <Briefcase size={18} />, color: 'text-amber-500', info: "Penerapan Situasi Nyata" },
    { id: ExamStyle.COMPETITIVE, label: 'Olimpiade', icon: <Target size={18} />, color: 'text-rose-500', info: "Soal Sulit & Pengecoh" },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-24 text-theme-text">
      <div className="text-center space-y-2">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-bold tracking-tighter"
        >
          Mikir <span className="font-light opacity-50 text-4xl">( •_•)</span>
        </motion.h1>
      </div>

      <DashboardMascot onOpenScheduler={() => setIsSchedulerOpen(true)} />

      {/* ACTIVE SESSION ALERT */}
      <AnimatePresence>
        {hasActiveSession && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="w-full">
            <button onClick={onContinue} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-3xl shadow-lg flex items-center justify-center space-x-3">
              <PlayCircle size={24} />
              <span className="text-lg font-bold">Lanjutkan Quiz</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SRS ALERT */}
      <AnimatePresence>
        {dueCards.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="w-full">
            <button onClick={() => setIsReviewing(true)} className="w-full bg-theme-primary text-white p-4 rounded-3xl shadow-lg flex items-center justify-between px-8">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-full"><Layers size={24} /></div>
                <div className="text-left"><h3 className="text-lg font-bold">Review Tersedia</h3></div>
              </div>
              <div className="text-right"><span className="text-3xl font-black">{dueCards.length}</span> <span className="text-xs block opacity-80">Kartu</span></div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONFIG CARD */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-theme-glass border border-theme-border rounded-[2.5rem] p-6 md:p-10 shadow-xl relative"
      >
        {/* INPUT TABS - SOLID BACKGROUND */}
        <div className="flex p-1 bg-theme-bg rounded-2xl mb-8 w-fit mx-auto border border-theme-border flex-wrap justify-center shadow-sm">
          <button onClick={() => { setInputMethod('file'); setTopic(''); }} className={`flex items-center space-x-2 px-4 md:px-6 py-2 rounded-xl transition-all ${inputMethod === 'file' ? 'bg-theme-primary text-white shadow-md font-bold' : 'text-theme-muted hover:text-theme-text hover:bg-theme-glass'}`}>
            <Upload size={18} /> <span>File</span>
          </button>
          <button onClick={() => { setInputMethod('topic'); setTopic(''); }} className={`flex items-center space-x-2 px-4 md:px-6 py-2 rounded-xl transition-all ${inputMethod === 'topic' ? 'bg-theme-primary text-white shadow-md font-bold' : 'text-theme-muted hover:text-theme-text hover:bg-theme-glass'}`}>
            <Type size={18} /> <span>Topik</span>
          </button>
          <button onClick={() => { setInputMethod('cloud'); setTopic(''); if(cloudNotes.length === 0) handleFetchNotes(); }} className={`flex items-center space-x-2 px-4 md:px-6 py-2 rounded-xl transition-all ${inputMethod === 'cloud' ? 'bg-theme-primary text-white shadow-md font-bold' : 'text-theme-muted hover:text-theme-text hover:bg-theme-glass'}`}>
            <Cloud size={18} /> <span>Notes</span>
          </button>
        </div>

        {/* INPUT AREA */}
        <div className="mb-8">
          
          {/* 1. FILE INPUT */}
          {inputMethod === 'file' && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className={`relative group cursor-pointer h-40 border-2 border-dashed rounded-3xl transition-all flex flex-col items-center justify-center text-center ${dragActive ? 'border-theme-primary bg-theme-primary/10' : file ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-theme-border hover:border-theme-primary hover:bg-theme-bg/20'}`}
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <input id="file-upload" type="file" className="hidden" accept=".pdf,.md,.txt,.ppt,.pptx" onChange={handleChangeFile} />
              {file ? (
                <div className="flex items-center space-x-3 font-medium"><FileText size={28} className="text-emerald-500" /><span>{file.name}</span></div>
              ) : (
                <div className="text-theme-muted"><Upload size={32} className="mx-auto mb-2 opacity-50" /><p className="text-sm">Drag & drop materi pelajaran</p></div>
              )}
            </motion.div>
          )}

          {/* 2. TOPIC INPUT (MANUAL) */}
          {inputMethod === 'topic' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <textarea 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Contoh: Sejarah Revolusi Industri..."
                className="w-full h-40 bg-theme-bg/50 border-2 border-theme-border rounded-3xl p-6 text-theme-text placeholder:text-theme-muted focus:outline-none focus:border-theme-primary focus:bg-theme-bg transition-all text-lg"
              />
            </motion.div>
          )}

          {/* 3. CLOUD NOTES INPUT (UPDATED FLOW) */}
          {inputMethod === 'cloud' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
               {/* If Note Selected: Show Selected Card + Title Editor */}
               {selectedNote ? (
                  <div className="space-y-4">
                     <div className="flex items-center justify-between bg-theme-primary/10 border border-theme-primary/30 p-4 rounded-2xl">
                        <div className="flex items-center gap-3 overflow-hidden">
                           <div className="p-2 bg-theme-primary text-white rounded-lg"><BookOpen size={20} /></div>
                           <div className="min-w-0">
                              <p className="text-xs text-theme-primary font-bold uppercase tracking-wider">Sumber Materi</p>
                              <p className="font-medium truncate text-sm">{selectedNote.title || "Catatan Tanpa Judul"}</p>
                           </div>
                        </div>
                        <button onClick={() => { setSelectedNote(null); setTopic(''); }} className="p-2 hover:bg-white/50 rounded-full transition-colors text-theme-muted hover:text-rose-500">
                           <X size={18} />
                        </button>
                     </div>

                     <div className="relative">
                        <label className="text-xs font-bold text-theme-muted uppercase tracking-wider ml-1 mb-1 block">Judul Kuis (Editable)</label>
                        <input 
                           type="text"
                           value={topic}
                           onChange={(e) => setTopic(e.target.value)}
                           className="w-full bg-theme-bg/50 border border-theme-border rounded-2xl px-4 py-4 pr-10 text-theme-text font-medium focus:ring-2 focus:ring-theme-primary focus:outline-none"
                           placeholder="Tentukan judul kuis..."
                        />
                        <Edit3 size={16} className="absolute right-4 top-9 text-theme-muted opacity-50" />
                     </div>
                  </div>
               ) : (
                 /* If No Note Selected: Show List */
                 <div className="h-64 bg-theme-bg/50 border border-theme-border rounded-3xl p-4 overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center mb-3 px-2">
                      <h3 className="text-sm font-bold flex items-center text-theme-muted"><Cloud size={16} className="mr-2" /> Pilih Catatan</h3>
                      <button onClick={handleFetchNotes} disabled={isLoadingNotes} className="p-1.5 hover:bg-theme-bg rounded-lg text-theme-muted transition-colors"><RefreshCw size={16} className={isLoadingNotes ? "animate-spin" : ""} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {cloudNotes.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-theme-muted text-xs text-center px-4">
                             <p>Tidak ada catatan.</p>
                             <button onClick={handleFetchNotes} className="mt-2 text-theme-primary font-bold hover:underline">Refresh</button>
                          </div>
                        ) : (
                          cloudNotes.map(note => (
                            <button key={note.id} onClick={() => handleSelectNote(note)} className="w-full text-left p-3 rounded-xl border bg-theme-bg/40 border-theme-border text-theme-text hover:border-theme-primary/50 hover:bg-white/50 transition-all text-sm group">
                                <div className="font-medium truncate group-hover:text-theme-primary transition-colors">{note.title || "Tanpa Judul"}</div>
                                <div className="text-[10px] text-theme-muted opacity-60 mt-1 flex justify-between">
                                   <span>{new Date(note.created_at).toLocaleDateString()}</span>
                                   {note.tags && note.tags.length > 0 && <span>#{note.tags[0]}</span>}
                                </div>
                            </button>
                          ))
                        )}
                    </div>
                 </div>
               )}
            </motion.div>
          )}
        </div>

        {/* SETTINGS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <div className="flex items-center mb-3 ml-1"><label className="text-sm font-medium">Mode Quiz</label></div>
            <div className="grid grid-cols-2 gap-3">
              {modes.map(m => (
                <button key={m.id} onClick={() => setMode(m.id)} className={`w-full p-4 rounded-xl border flex flex-col items-start transition-all text-left h-full ${mode === m.id ? 'bg-theme-primary/10 border-theme-primary text-theme-primary shadow-sm' : 'bg-theme-bg/20 border-transparent text-theme-muted hover:bg-theme-bg/40'}`}>
                  <div className="flex items-center space-x-2 mb-1">{m.icon} <span className="text-sm font-semibold">{m.label}</span></div>
                  <span className="text-xs opacity-70">{m.info}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center mb-3 ml-1"><label className="text-sm font-medium">Fokus Soal</label></div>
            <div className="grid grid-cols-2 gap-3">
              {examStyles.map(s => (
                <button key={s.id} onClick={() => setExamStyle(s.id)} className={`w-full p-4 rounded-xl border flex flex-col items-start transition-all text-left h-full ${examStyle === s.id ? `bg-theme-bg border-current ${s.color} shadow-sm` : 'bg-theme-bg/20 border-transparent text-theme-muted hover:bg-theme-bg/40'}`}>
                  <div className="flex items-center space-x-2 mb-1">{s.icon} <span className="text-sm font-semibold">{s.label}</span></div>
                   <span className="text-xs opacity-70">{s.info}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 mb-8">
           <div className="space-y-3">
             <div className="flex justify-between text-sm font-medium"><span>Jumlah Soal</span> <span>{questionCount}</span></div>
             <input type="range" min="5" max="50" step="5" value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} className="w-full h-2 bg-theme-bg rounded-lg appearance-none cursor-pointer accent-theme-primary" />
           </div>
           
           <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <label className="text-sm font-medium ml-1">AI Provider</label>
                 
                 {/* HIGH CONTRAST PROVIDER TABS */}
                 <div className="flex bg-theme-glass p-1 rounded-xl border border-theme-border">
                    <button 
                       onClick={() => handleProviderChange('gemini')} 
                       className={`flex-1 py-2.5 text-sm rounded-lg flex items-center justify-center transition-all font-medium ${provider === 'gemini' ? 'bg-theme-primary text-white shadow-md' : 'text-theme-muted hover:text-theme-text hover:bg-theme-bg/50'}`}
                    >
                       <Zap size={16} className="mr-2" /> Gemini
                    </button>
                    <button 
                       onClick={() => handleProviderChange('groq')} 
                       className={`flex-1 py-2.5 text-sm rounded-lg flex items-center justify-center transition-all font-medium ${provider === 'groq' ? 'bg-orange-500 text-white shadow-md' : 'text-theme-muted hover:text-orange-500 hover:bg-theme-bg/50'}`}
                    >
                       <Cpu size={16} className="mr-2" /> Groq
                    </button>
                 </div>
              </div>
              <div className="space-y-2">
                 <label className="text-sm font-medium ml-1">Model</label>
                 <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="w-full bg-theme-glass border border-theme-border rounded-xl px-3 py-2.5 text-sm text-theme-text focus:outline-none focus:border-theme-primary">
                   {filteredModels.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                 </select>
              </div>
           </div>
        </div>

        <GlassButton fullWidth onClick={handleStart} disabled={!isReady}>
          {inputMethod === 'file' ? 'Analisis Dokumen & Buat Soal' : inputMethod === 'topic' ? 'Generate Soal dari Topik' : 'Generate Soal dari Catatan'}
        </GlassButton>

      </motion.div>

      <StudyScheduler isOpen={isSchedulerOpen} onClose={() => setIsSchedulerOpen(false)} defaultTopic={inputMethod === 'topic' ? topic : file?.name} />
      <AnimatePresence>
        {isReviewing && (
          <FlashcardScreen questions={dueCards} onClose={() => { setIsReviewing(false); const updatedDue = getDueItems(); setDueCards(updatedDue.map(i => i.question)); }} />
        )}
      </AnimatePresence>
    </div>
  );
};
