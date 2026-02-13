
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

import { generateQuiz } from './services/geminiService';
import { generateQuizGroq } from './services/groqService';
import { saveGeneratedQuiz, getApiKey, updateHistoryStats, getSavedQuizzes, deleteQuiz, updateLocalQuizQuestions } from './services/storageService'; 
import { checkAndTriggerNotification } from './services/notificationService';
import { notifyQuizReady } from './services/kaomojiNotificationService'; 
import { initTheme } from './services/themeService'; 
import { getKeycardSession } from './services/keycardService'; 
import { QuizState, Question, QuizResult, ModelConfig, QuizMode, AppView } from './types';
import { Info } from 'lucide-react';

const App: React.FC = () => {
  // Navigation State
  const [currentView, setCurrentView] = useState<AppView>(AppView.GENERATOR);
  
  // Quiz Flow State
  const [quizState, setQuizState] = useState<QuizState>(QuizState.CONFIG);
  
  // Data State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [originalQuestions, setOriginalQuestions] = useState<Question[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [activeQuizId, setActiveQuizId] = useState<string | number | null>(null); 
  const [lastConfig, setLastConfig] = useState<{file: File | null, config: ModelConfig} | null>(null); // For "Add More" feature
  
  // UI Status State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>("Inisialisasi...");
  const [activeMode, setActiveMode] = useState<QuizMode>(QuizMode.STANDARD);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  // AUTH STATE
  const [isLocked, setIsLocked] = useState(true);

  // Initial Check for API Key & Notifications & Theme
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

  const startQuizGeneration = async (file: File | null, config: ModelConfig) => {
    const apiKey = getApiKey(config.provider);
    
    if (!apiKey) {
      alert(`Harap masukkan API Key untuk ${config.provider === 'gemini' ? 'Gemini' : 'Groq'}.`);
      return;
    }

    // 1. UPDATE STATE IMMEDIATELY to show loading screen
    setLoadingStatus(file ? "Membaca Dokumen..." : "Menganalisis Topik...");
    setQuizState(QuizState.PROCESSING); 
    setErrorMsg(null);
    setActiveMode(config.mode);
    setLastConfig({ file, config }); 

    // 2. Perform Async Op wrapped in setTimeout to yield control to React Render
    // This fixes the "White Screen" freeze by ensuring the loading screen renders first.
    setTimeout(async () => {
        try {
          let generatedQuestions: Question[] = [];

          if (config.provider === 'gemini') {
            const result = await generateQuiz(
              apiKey,
              file,
              config.topic,
              config.modelId, 
              config.questionCount, 
              config.mode,
              config.examStyle,
              (status) => setLoadingStatus(status)
            );
            generatedQuestions = result.questions;
          } else {
            const result = await generateQuizGroq(
              apiKey,
              file,
              config.topic,
              config.modelId,
              config.questionCount, 
              config.mode,
              config.examStyle,
              (status) => setLoadingStatus(status)
            );
            generatedQuestions = result.questions;
          }
          
          if (!generatedQuestions || generatedQuestions.length === 0) {
            throw new Error("AI tidak menghasilkan soal. Coba topik lain.");
          }

          setQuestions(generatedQuestions);
          setOriginalQuestions(generatedQuestions);

          notifyQuizReady(generatedQuestions.length);

          setLoadingStatus("Menyimpan Quiz...");
          try {
            await saveGeneratedQuiz(file, config, generatedQuestions);
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

  // --- NEW FEATURE: ADD MORE QUESTIONS (FIXED) ---
  const handleAddMoreQuestions = async (count: number) => {
    if (!lastConfig) return;

    // 1. Force UI update first to avoid white screen lag
    setLoadingStatus(`Meracik ${count} soal tambahan...`);
    setQuizState(QuizState.PROCESSING);

    // Use setTimeout to allow React to render the LoadingScreen before heavy lifting
    setTimeout(async () => {
        try {
            const existingTexts = originalQuestions.map(q => q.text);
            const apiKey = getApiKey(lastConfig.config.provider);
            if (!apiKey) throw new Error("API Key missing");
      
            let newQuestions: Question[] = [];
            const { file, config } = lastConfig;
      
            if (config.provider === 'gemini') {
              const res = await generateQuiz(
                apiKey, file, config.topic, config.modelId, count, config.mode, config.examStyle,
                (status) => setLoadingStatus(status),
                existingTexts
              );
              newQuestions = res.questions;
            } else {
              const res = await generateQuizGroq(
                apiKey, file, config.topic, config.modelId, count, config.mode, config.examStyle,
                (status) => setLoadingStatus(status),
                existingTexts
              );
              newQuestions = res.questions;
            }
            
            // Fix IDs for new questions
            const maxId = Math.max(...originalQuestions.map(q => q.id), 0);
            const indexedNewQuestions = newQuestions.map((q, i) => ({ ...q, id: maxId + i + 1 }));
            
            const mergedQuestions = [...originalQuestions, ...indexedNewQuestions];
            
            setQuestions(mergedQuestions);
            setOriginalQuestions(mergedQuestions);
            
            if (activeQuizId) {
               await updateLocalQuizQuestions(activeQuizId, mergedQuestions);
            }
            
            setResult(null); 
            setQuizState(QuizState.QUIZ_ACTIVE); 
      
          } catch (e: any) {
            alert("Gagal menambah soal: " + e.message);
            // Revert safely
            setQuestions(originalQuestions); 
            setQuizState(QuizState.RESULTS); 
          }
    }, 100);
  };

  const handleImportQuiz = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json.questions || !Array.isArray(json.questions)) throw new Error("Format invalid.");
        setQuestions(json.questions);
        setOriginalQuestions(json.questions);
        setActiveMode(QuizMode.STANDARD);
        setActiveQuizId(null);
        setErrorMsg(null);
        setResult(null);
        setQuizState(QuizState.QUIZ_ACTIVE);
        setLastConfig(null); 
        alert(`Berhasil mengimpor ${json.questions.length} soal!`);
      } catch (err) { alert("Gagal membaca file quiz."); }
    };
    reader.readAsText(file);
  };

  const handleLoadHistory = (savedQuiz: any) => {
    setQuestions(savedQuiz.questions);
    setOriginalQuestions(savedQuiz.questions);
    setActiveMode(savedQuiz.mode);
    setActiveQuizId(savedQuiz.id);
    setErrorMsg(null);
    setResult(null);
    setQuizState(QuizState.QUIZ_ACTIVE);
    setLastConfig({
       file: null,
       config: {
         provider: savedQuiz.provider || 'gemini',
         modelId: savedQuiz.modelId,
         questionCount: 10,
         mode: savedQuiz.mode,
         examStyle: 'CONCEPTUAL' as any,
         topic: savedQuiz.topicSummary
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

  const handleQuizComplete = (finalResult: QuizResult) => {
    setResult(finalResult);
    setQuizState(QuizState.RESULTS);
    if (activeQuizId) {
       const percentage = Math.round((finalResult.correctCount / finalResult.totalQuestions) * 100);
       updateHistoryStats(activeQuizId, percentage);
    }
  };

  const handleExitQuiz = () => {
     setQuizState(QuizState.CONFIG);
     setCurrentView(AppView.GENERATOR);
  };

  const handleDeleteActiveQuiz = async () => {
    if (activeQuizId) { await deleteQuiz(activeQuizId); }
    resetApp();
  };

  const handleRetryMistakes = () => {
    if (!result) return;
    const wrongQuestionIds = result.answers.filter(a => !a.isCorrect).map(a => a.questionId);
    const mistakesToRetry = originalQuestions.filter(q => wrongQuestionIds.includes(q.id));
    if (mistakesToRetry.length > 0) {
      setQuestions(mistakesToRetry);
      setResult(null);
      setQuizState(QuizState.QUIZ_ACTIVE);
    }
  };

  const handleRetryAll = () => {
    setQuestions(originalQuestions); 
    setResult(null);
    setQuizState(QuizState.QUIZ_ACTIVE);
  };

  const handleContinueQuiz = () => {
    if (questions.length > 0) setQuizState(QuizState.QUIZ_ACTIVE);
  };

  const resetApp = () => {
    setQuestions([]);
    setOriginalQuestions([]);
    setResult(null);
    setErrorMsg(null);
    setActiveQuizId(null);
    setLastConfig(null);
    setQuizState(QuizState.CONFIG);
  };

  if (isLocked) return <LoginGate onUnlock={handleUnlock} />;

  const renderContent = () => {
    if (quizState === QuizState.PROCESSING) return <LoadingScreen status={loadingStatus} />;
    
    // SAFEGUARD: Ensure questions exist before rendering interface
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
      case AppView.HISTORY: return <HistoryScreen onLoadHistory={handleLoadHistory} />;
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
    <div className="min-h-screen p-4 md:p-8 relative pb-24 transition-colors duration-500">
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
