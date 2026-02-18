
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ConfigScreen } from './components/ConfigScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { QuizInterface } from './components/QuizInterface';
import { ResultScreen } from './components/ResultScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { VirtualRoom } from './components/VirtualRoom';
import { Navigation } from './components/Navigation';
import { LoginGate } from './components/LoginGate'; 
import { UniversalQuestionCard } from './components/UniversalQuestionCard'; // NEW

import { generateQuiz } from './services/geminiService';
import { generateQuizGroq } from './services/groqService';
import { transformToMixed } from './services/questionTransformer'; // NEW
import { saveGeneratedQuiz, getApiKey, updateHistoryStats, getSavedQuizzes, deleteQuiz, updateLocalQuizQuestions } from './services/storageService'; 
import { createRetentionSequence } from './services/srsService'; 
import { checkAndTriggerNotification } from './services/notificationService';
import { notifyQuizReady } from './services/kaomojiNotificationService'; 
import { initTheme } from './services/themeService'; 
import { getKeycardSession } from './services/keycardService'; 
import { QuizState, Question, QuizResult, ModelConfig, QuizMode, AppView } from './types';
import { Info } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.GENERATOR);
  const [quizState, setQuizState] = useState<QuizState>(QuizState.CONFIG);
  
  // Questions State
  const [questions, setQuestions] = useState<Question[]>([]); // The active playable list (includes repeats)
  const [originalQuestions, setOriginalQuestions] = useState<Question[]>([]); // The base generated questions (unique)
  
  const [result, setResult] = useState<QuizResult | null>(null);
  const [activeQuizId, setActiveQuizId] = useState<string | number | null>(null); 
  const [lastConfig, setLastConfig] = useState<{files: File[] | null, config: ModelConfig} | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>("Inisialisasi...");
  const [activeMode, setActiveMode] = useState<QuizMode>(QuizMode.STANDARD);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isLocked, setIsLocked] = useState(true);

  useEffect(() => {
    initTheme();
    checkAndTriggerNotification();
    checkAuth();
  }, []);

  const checkAuth = () => {
    const geminiKey = getApiKey('gemini');
    const groqKey = getApiKey('groq');
    if (geminiKey || groqKey) setIsLocked(false);
    else setIsLocked(true);
  };

  const handleUnlock = () => setIsLocked(false);

  const startQuizGeneration = async (files: File[] | null, config: ModelConfig) => {
    const apiKey = getApiKey(config.provider);
    
    if (!apiKey) {
      alert(`Harap masukkan API Key untuk ${config.provider === 'gemini' ? 'Gemini' : 'Groq'}.`);
      return;
    }

    const fileCount = files ? files.length : 0;
    const hasLibrary = config.libraryContext && config.libraryContext.length > 0;
    
    setLoadingStatus(hasLibrary ? "Membaca Library..." : (fileCount > 0 ? `Membaca ${fileCount} Dokumen...` : "Menganalisis Topik..."));
    setQuizState(QuizState.PROCESSING); 
    setErrorMsg(null);
    setActiveMode(config.mode);
    setLastConfig({ files, config }); 

    setTimeout(async () => {
        try {
          let generatedQuestions: Question[] = [];

          // Universal Call (Handles Library + Files + Topic)
          if (config.provider === 'gemini') {
            const result = await generateQuiz(
              apiKey,
              files,
              config.topic,
              config.modelId, 
              config.questionCount, 
              config.mode,
              config.examStyle,
              (status) => setLoadingStatus(status),
              [],
              config.customPrompt,
              config.libraryContext 
            );
            generatedQuestions = result.questions;
          } else {
             const result = await generateQuizGroq(
              apiKey,
              files,
              config.libraryContext ? `CONTEXT:\n${config.libraryContext}\n\nTOPIC: ${config.topic}` : config.topic, 
              config.modelId,
              config.questionCount, 
              config.mode,
              config.examStyle,
              (status) => setLoadingStatus(status),
              [],
              config.customPrompt
            );
            generatedQuestions = result.questions;
          }
          
          if (!generatedQuestions || generatedQuestions.length === 0) {
            throw new Error("AI tidak menghasilkan soal. Coba topik lain.");
          }

          // --- APPLY CLIENT-SIDE TRANSFORMATIONS (NEW) ---
          if (config.enableMixedTypes) {
             setLoadingStatus("Mengonversi Tipe Soal (Client-Side)...");
             // Transform standard MCQ to T/F and FillBlank locally
             generatedQuestions = transformToMixed(generatedQuestions);
          }

          // --- APPLY RETENTION LOGIC ---
          setOriginalQuestions(generatedQuestions); // Save pure unique questions
          
          let playableQuestions = generatedQuestions;
          if (config.enableRetention) {
             setLoadingStatus("Menyusun Algoritma Retensi...");
             // Increase by ~60% (e.g. 10 -> 16 questions)
             playableQuestions = createRetentionSequence(generatedQuestions, 0.6);
          }
          
          setQuestions(playableQuestions);

          notifyQuizReady(playableQuestions.length);

          setLoadingStatus("Menyimpan Quiz...");
          try {
            const saveFileRef = files && files.length > 0 ? files[0] : null; 
            // Save ONLY ORIGINAL questions to history to save space/sanity
            await saveGeneratedQuiz(saveFileRef, config, generatedQuestions);
            const latest = await getSavedQuizzes();
            if (latest.length > 0) setActiveQuizId(latest[0].id);
          } catch (saveError) {
            console.error("Non-fatal error saving quiz:", saveError);
          }
          
          setQuizState(QuizState.QUIZ_ACTIVE);

        } catch (error: any) {
          console.error(error);
          setErrorMsg(error.message || "Terjadi kesalahan. Periksa API Key atau koneksi.");
          setQuizState(QuizState.ERROR);
        }
    }, 100);
  };

  const handleAddMoreQuestions = async (count: number) => {
    if (!lastConfig) return;
    setLoadingStatus(`Meracik ${count} soal tambahan...`);
    setQuizState(QuizState.PROCESSING);

    setTimeout(async () => {
        try {
            const existingTexts = originalQuestions.map(q => q.text);
            const apiKey = getApiKey(lastConfig.config.provider);
            if (!apiKey) throw new Error("API Key missing");
            let newQuestions: Question[] = [];
            const { files, config } = lastConfig;
      
            if (config.provider === 'gemini') {
              const res = await generateQuiz(
                apiKey, files, config.topic, config.modelId, count, config.mode, config.examStyle,
                (status) => setLoadingStatus(status),
                existingTexts,
                config.customPrompt,
                config.libraryContext
              );
              newQuestions = res.questions;
            } else {
               const res = await generateQuizGroq(
                apiKey,
                files,
                config.libraryContext ? `CONTEXT:\n${config.libraryContext}\n\nTOPIC: ${config.topic}` : config.topic,
                config.modelId,
                count, 
                config.mode,
                config.examStyle,
                (status) => setLoadingStatus(status),
                existingTexts,
                config.customPrompt
              );
              newQuestions = res.questions;
            }
            
            // --- TRANSFORM NEW QUESTIONS TOO ---
            if (config.enableMixedTypes) {
               newQuestions = transformToMixed(newQuestions);
            }

            const maxId = Math.max(...originalQuestions.map(q => q.id), 0);
            const indexedNewQuestions = newQuestions.map((q, i) => ({ ...q, id: maxId + i + 1 }));
            
            // Merge Originals
            const mergedOriginals = [...originalQuestions, ...indexedNewQuestions];
            setOriginalQuestions(mergedOriginals);
            
            // Merge Playables (Use retention if previously enabled)
            let finalPlayable = mergedOriginals;
            if (config.enableRetention) {
               finalPlayable = createRetentionSequence(mergedOriginals, 0.6);
            }
            
            setQuestions(finalPlayable);
            
            if (activeQuizId) { await updateLocalQuizQuestions(activeQuizId, mergedOriginals); }
            setResult(null); 
            setQuizState(QuizState.QUIZ_ACTIVE); 
      
          } catch (e: any) {
            alert("Gagal menambah soal: " + e.message);
            setQuestions(originalQuestions); 
            setQuizState(QuizState.RESULTS); 
          }
    }, 100);
  };

  const handleImportQuiz = (file: File) => { /* ... same as before ... */ };
  const handleLoadHistory = (savedQuiz: any) => {
    setQuestions(savedQuiz.questions);
    setOriginalQuestions(savedQuiz.questions);
    setActiveMode(savedQuiz.mode);
    setActiveQuizId(savedQuiz.id);
    setErrorMsg(null);
    setResult(null);
    setQuizState(QuizState.QUIZ_ACTIVE);
    
    setLastConfig({
       files: null,
       config: {
         provider: savedQuiz.provider || 'gemini',
         modelId: savedQuiz.modelId,
         questionCount: 10,
         mode: savedQuiz.mode,
         examStyle: 'CONCEPTUAL' as any,
         topic: savedQuiz.topicSummary,
         customPrompt: "" 
       }
    });
    setCurrentView(AppView.GENERATOR);
  };
  const handleStartMixer = (mixedQuestions: Question[]) => {
     setQuestions(mixedQuestions);
     setOriginalQuestions(mixedQuestions);
     setActiveMode(QuizMode.STANDARD);
     setActiveQuizId(null); 
     setErrorMsg(null);
     setResult(null);
     setLastConfig(null);
     setQuizState(QuizState.QUIZ_ACTIVE);
  };
  
  // NEW: Remix Handler
  const handleRemix = (sourceQuestions: Question[]) => {
     setLoadingStatus("Remixing Soal...");
     setQuizState(QuizState.PROCESSING);
     
     setTimeout(() => {
        // Transform (Change Types + Shuffle Options logic inside)
        // Note: transformToMixed creates new objects but keeps IDs. 
        // We might want to shuffle the order of questions too.
        const mixed = transformToMixed(sourceQuestions).sort(() => Math.random() - 0.5);
        
        setQuestions(mixed);
        setOriginalQuestions(mixed); // Update source of truth for this session
        setResult(null);
        setQuizState(QuizState.QUIZ_ACTIVE);
     }, 500);
  };
  
  const handleQuizComplete = (finalResult: QuizResult) => {
    setResult(finalResult);
    setQuizState(QuizState.RESULTS);
    if (activeQuizId) {
       const percentage = Math.round((finalResult.correctCount / finalResult.totalQuestions) * 100);
       updateHistoryStats(activeQuizId, percentage);
    }
  };
  const handleExitQuiz = () => { setQuizState(QuizState.CONFIG); setCurrentView(AppView.GENERATOR); };
  
  const handleDeleteActiveQuiz = async () => { 
      if (activeQuizId) { 
          await deleteQuiz(activeQuizId); 
      } 
      resetApp(); 
  };
  
  const handleRetryMistakes = () => {
    if (!result) return;
    const wrongQuestionIds = result.answers.filter(a => !a.isCorrect).map(a => a.questionId);
    
    // Filter from 'questions' (which might contain repeats with unique IDs)
    const mistakesToRetry = questions.filter(q => wrongQuestionIds.includes(q.id));
    
    if (mistakesToRetry.length > 0) { setQuestions(mistakesToRetry); setResult(null); setQuizState(QuizState.QUIZ_ACTIVE); }
  };
  const handleRetryAll = () => { 
      // Retry the exact same session sequence
      setQuestions(questions); 
      setResult(null); 
      setQuizState(QuizState.QUIZ_ACTIVE); 
  };
  const handleContinueQuiz = () => { if (questions.length > 0) setQuizState(QuizState.QUIZ_ACTIVE); };
  const resetApp = () => {
    setQuestions([]); setOriginalQuestions([]); setResult(null); setErrorMsg(null); setActiveQuizId(null); setLastConfig(null); setQuizState(QuizState.CONFIG);
  };

  if (isLocked) return <LoginGate onUnlock={handleUnlock} />;

  const renderContent = () => {
    if (quizState === QuizState.PROCESSING) return <LoadingScreen status={loadingStatus} />;
    
    if (quizState === QuizState.QUIZ_ACTIVE) {
        if (!questions || questions.length === 0) {
            setQuizState(QuizState.ERROR);
            setErrorMsg("Data soal kosong atau corrupt.");
            return null;
        }
        
        return (
          <QuizInterface 
            questions={questions} 
            mode={activeMode} 
            onComplete={handleQuizComplete} 
            onExit={handleExitQuiz}
            onDelete={activeQuizId ? handleDeleteActiveQuiz : undefined}
          />
        );
    }
    
    if (quizState === QuizState.RESULTS && result) {
        return (
            <ResultScreen 
              result={result} 
              questions={originalQuestions} 
              onReset={resetApp} 
              onRetryMistakes={handleRetryMistakes}
              onRetryAll={handleRetryAll}
              onDelete={activeQuizId ? handleDeleteActiveQuiz : undefined}
              onAddMore={lastConfig ? handleAddMoreQuestions : undefined}
              onRemix={handleRemix} // Pass the handler
            />
        );
    }
    
    if (quizState === QuizState.ERROR) {
      return (
        <div className="text-center mt-20">
           <div className="bg-red-50/50 backdrop-blur-md border border-red-200 p-8 rounded-3xl inline-block max-w-md">
             <h3 className="text-red-800 text-xl font-medium mb-2">Oops!</h3>
             <p className="text-red-600 mb-6">{errorMsg}</p>
             <button onClick={resetApp} className="px-6 py-2 bg-red-100 text-red-700 rounded-xl hover:bg-red-200">Kembali</button>
           </div>
        </div>
      );
    }

    switch (currentView) {
      case AppView.SETTINGS: return <SettingsScreen />;
      case AppView.WORKSPACE: return <HistoryScreen onLoadHistory={handleLoadHistory} />; 
      case AppView.VIRTUAL_ROOM: return <VirtualRoom onStartMix={handleStartMixer} />;
      case AppView.GENERATOR: default: 
        return (
            <ConfigScreen 
                onStart={startQuizGeneration} 
                onContinue={handleContinueQuiz}
                hasActiveSession={questions.length > 0 && quizState === QuizState.CONFIG && !result}
            />
        );
    }
  };

  return (
    <div className="min-h-[100dvh] p-4 md:p-8 relative pb-24 transition-colors duration-500">
      <button 
        onClick={() => setShowAnalysis(!showAnalysis)}
        className="fixed top-6 right-6 z-40 p-2 rounded-full bg-theme-glass border border-theme-border text-theme-muted hover:bg-theme-bg shadow-sm"
      >
        <Info size={24} />
      </button>

      <AnimatePresence>
        {showAnalysis && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowAnalysis(false)}
          >
            <div className="bg-theme-bg/90 backdrop-blur-xl max-w-lg w-full rounded-3xl p-8 shadow-2xl border border-theme-border" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold mb-4 text-theme-text">Mikir ( •_•)</h2>
              <p className="text-sm text-theme-text mb-4">
                Aplikasi ini berjalan 100% di browser kamu. Tidak ada backend server yang menyimpan data pribadimu kecuali kamu menghubungkan Supabase.
              </p>
              <div className="p-4 bg-theme-primary/10 rounded-xl mb-4 border border-theme-primary/20">
                <p className="text-xs text-theme-primary font-medium">Crafted with 🌽 by Bakwan Jagung</p>
              </div>
              <button onClick={() => setShowAnalysis(false)} className="w-full py-2 bg-theme-primary text-white rounded-xl">Tutup</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto pt-8">
        <AnimatePresence mode='wait'>
          <motion.div 
            key={currentView + quizState} 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {quizState !== QuizState.PROCESSING && quizState !== QuizState.QUIZ_ACTIVE && (
        <Navigation currentView={currentView} onChangeView={setCurrentView} />
      )}

      <div className="fixed bottom-1 left-0 w-full text-center z-40 pointer-events-none">
        <p className="text-[10px] text-theme-muted opacity-50 font-medium tracking-widest uppercase">
          crafted by Bakwan Jagung 🌽
        </p>
      </div>
    </div>
  );
};

export default App;
