
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { SynapseCanvas } from './SynapseCanvas';
import { ArrowLeft, Music, Zap, Trophy, HardDrive, Cloud, Loader2, X, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSavedQuizzes, fetchCloudQuizzes } from '../services/storageService';

interface SynapseRoomProps {
    onExit: () => void;
}

export const SynapseRoom: React.FC<SynapseRoomProps> = ({ onExit }) => {
    const { questions, setQuestions } = useAppStore();
    const [gameStarted, setGameStarted] = useState(false);
    const [finalScore, setFinalScore] = useState<number | null>(null);

    // Load Menu State
    const [showLoadMenu, setShowLoadMenu] = useState(false);
    const [loadSource, setLoadSource] = useState<'local' | 'cloud' | null>(null);
    const [quizList, setQuizList] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleGameComplete = (score: number) => {
        setFinalScore(score);
        setGameStarted(false);
    };

    const handleOpenLoadMenu = async (source: 'local' | 'cloud') => {
        setLoadSource(source);
        setShowLoadMenu(true);
        setIsLoading(true);
        setQuizList([]);

        try {
            let data = [];
            if (source === 'local') {
                data = await getSavedQuizzes();
            } else {
                data = await fetchCloudQuizzes('public'); // Default to public for arcade
            }
            setQuizList(data);
        } catch (error) {
            console.error("Failed to load quizzes:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectQuiz = (quiz: any) => {
        let loadedQuestions = [];
        if (Array.isArray(quiz.questions)) {
            loadedQuestions = quiz.questions;
        } else if (typeof quiz.questions === 'string') {
            try {
                loadedQuestions = JSON.parse(quiz.questions);
            } catch (e) {
                console.error("Failed to parse questions", e);
            }
        }

        if (loadedQuestions.length > 0) {
            setQuestions(loadedQuestions);
            setShowLoadMenu(false);
        } else {
            alert("Quiz ini tidak memiliki soal yang valid.");
        }
    };

    if (gameStarted && questions.length > 0) {
        return (
            <SynapseCanvas 
                questions={questions}
                onComplete={handleGameComplete}
                onExit={() => setGameStarted(false)}
            />
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white font-mono relative overflow-hidden flex flex-col items-center justify-center">
            {/* Retro Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
            
            <div className="z-10 max-w-2xl w-full p-8 text-center">
                <motion.div 
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="mb-12"
                >
                    <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-pink-500 to-purple-600 mb-4" style={{ textShadow: '0 4px 0 #fff' }}>
                        SYNAPSE
                    </h1>
                    <div className="inline-block px-4 py-1 bg-cyan-500 text-black font-bold tracking-widest transform -skew-x-12">
                        VIRTUAL ROOM: ARCADE
                    </div>
                </motion.div>

                {finalScore !== null && (
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="mb-8 bg-black/50 border-2 border-yellow-500 p-6 rounded-xl"
                    >
                        <div className="text-yellow-500 text-sm mb-2 uppercase tracking-widest">Last Run Score</div>
                        <div className="text-5xl font-bold text-white">{finalScore.toLocaleString()}</div>
                    </motion.div>
                )}

                {/* LOAD CARTRIDGE SECTION */}
                <div className="mb-8 grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => handleOpenLoadMenu('local')}
                        className="bg-slate-800/80 border-2 border-slate-600 hover:border-green-400 hover:text-green-400 p-4 rounded-xl transition-all group flex flex-col items-center gap-2"
                    >
                        <HardDrive size={24} className="text-slate-400 group-hover:text-green-400 transition-colors" />
                        <span className="text-xs font-bold tracking-widest">LOCAL STORAGE</span>
                    </button>
                    <button 
                        onClick={() => handleOpenLoadMenu('cloud')}
                        className="bg-slate-800/80 border-2 border-slate-600 hover:border-cyan-400 hover:text-cyan-400 p-4 rounded-xl transition-all group flex flex-col items-center gap-2"
                    >
                        <Cloud size={24} className="text-slate-400 group-hover:text-cyan-400 transition-colors" />
                        <span className="text-xs font-bold tracking-widest">CLOUD DATABASE</span>
                    </button>
                </div>

                <div className="flex flex-col gap-4 max-w-md mx-auto">
                    <button 
                        onClick={() => setGameStarted(true)}
                        disabled={questions.length === 0}
                        className="w-full py-4 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xl rounded-none border-b-4 border-pink-800 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Zap fill="currentColor" /> 
                        {questions.length > 0 ? `START SESSION (${questions.length} Q)` : 'INSERT CARTRIDGE'}
                    </button>
                    
                    <button 
                        onClick={onExit}
                        className="w-full py-4 bg-transparent border-2 border-slate-700 text-slate-400 hover:text-white hover:border-white font-bold transition-all flex items-center justify-center gap-2"
                    >
                        <ArrowLeft size={20} /> EXIT ROOM
                    </button>
                </div>
                
                {questions.length === 0 && (
                    <p className="mt-4 text-slate-500 text-xs font-mono">
                        *Select Local or Cloud storage to load a quiz cartridge.
                    </p>
                )}
            </div>

            {/* LOAD MENU MODAL */}
            <AnimatePresence>
                {showLoadMenu && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-slate-900 border-2 border-slate-700 w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-4 border-b-2 border-slate-700 flex items-center justify-between bg-slate-800">
                                <div className="flex items-center gap-2">
                                    {loadSource === 'local' ? <HardDrive className="text-green-400" /> : <Cloud className="text-cyan-400" />}
                                    <h2 className="text-xl font-bold tracking-widest text-white">
                                        SELECT CARTRIDGE
                                    </h2>
                                </div>
                                <button onClick={() => setShowLoadMenu(false)} className="text-slate-400 hover:text-white">
                                    <X />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                                        <Loader2 className="animate-spin mb-2" size={32} />
                                        <p>SCANNING DATA...</p>
                                    </div>
                                ) : quizList.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
                                        NO DATA FOUND
                                    </div>
                                ) : (
                                    quizList.map((quiz, idx) => (
                                        <motion.button
                                            key={quiz.id || idx}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            onClick={() => handleSelectQuiz(quiz)}
                                            className="w-full text-left p-4 bg-slate-800/50 border border-slate-700 hover:bg-slate-700 hover:border-pink-500 hover:text-pink-400 transition-all rounded-lg group flex items-center justify-between"
                                        >
                                            <div>
                                                <h3 className="font-bold truncate max-w-md">{quiz.fileName || quiz.file_name || "Untitled Quiz"}</h3>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                    <span className="bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">
                                                        {Array.isArray(quiz.questions) ? quiz.questions.length : JSON.parse(quiz.questions || '[]').length} Q
                                                    </span>
                                                    <span>•</span>
                                                    <span>{new Date(quiz.date || quiz.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <Play className="opacity-0 group-hover:opacity-100 transition-opacity" size={20} fill="currentColor" />
                                        </motion.button>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

