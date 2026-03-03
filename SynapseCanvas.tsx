

import React, { useEffect, useRef, useState } from 'react';
import { SynapseEngine } from '../services/synapseEngine';
import { Question } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RefreshCw, XCircle, Zap, Heart, Lock } from 'lucide-react';

interface SynapseCanvasProps {
    questions: Question[]; 
    audioUrl?: string; 
    onComplete: (score: number) => void;
    onExit: () => void;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}

interface FloatingText {
    id: number;
    x: number;
    y: number;
    text: string;
    life: number;
    color: string;
}

export const SynapseCanvas: React.FC<SynapseCanvasProps> = ({ questions, audioUrl, onComplete, onExit }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<SynapseEngine | null>(null);
    const requestRef = useRef<number>();
    
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [combo, setCombo] = useState(0);
    const [multiplier, setMultiplier] = useState(1);
    const [health, setHealth] = useState(100);
    const [phase, setPhase] = useState('HOOK');
    const [isPlaying, setIsPlaying] = useState(false);
    const [isReady, setIsReady] = useState(false);

    const currentQuestion = questions[currentQIndex];

    // Visual FX State (Refs for performance)
    const particlesRef = useRef<Particle[]>([]);
    const floatingTextsRef = useRef<FloatingText[]>([]);
    const shakeRef = useRef(0); 

    // Initialize Engine
    useEffect(() => {
        const engine = new SynapseEngine({
            bpm: 135, 
            noteSpeed: 500, 
            laneCount: 4,
            audioUrl: audioUrl
        });

        engine.setQuestion(questions[0]);

        engine.setOnHit((note, rating) => {
            const laneWidth = window.innerWidth / 4;
            const x = note.lane * laneWidth + laneWidth / 2;
            const y = window.innerHeight - 100;
            
            // Particles only on initial hit or hold completion
            if (!note.isHold || (note.isHold && note.holdProgress >= 1)) {
                 for (let i = 0; i < 15; i++) {
                    particlesRef.current.push({
                        x, y,
                        vx: (Math.random() - 0.5) * 15,
                        vy: (Math.random() - 1) * 15,
                        life: 1.0,
                        color: ['#ef4444', '#3b82f6', '#22c55e', '#eab308'][note.lane]
                    });
                }
                
                floatingTextsRef.current.push({
                    id: Math.random(),
                    x, y: y - 80,
                    text: rating.toUpperCase() + "!",
                    life: 1.0,
                    color: rating === 'perfect' ? '#fbbf24' : '#fff'
                });

                if (rating === 'perfect') shakeRef.current = 5;
            } else if (note.isHold && note.isHolding) {
                // Continuous particles for holding
                 particlesRef.current.push({
                    x: x + (Math.random() - 0.5) * 40, 
                    y: y + (Math.random() - 0.5) * 10,
                    vx: (Math.random() - 0.5) * 5,
                    vy: (Math.random() - 1) * 10,
                    life: 0.5,
                    color: '#fff'
                });
            }
        });

        engine.setOnMiss((note) => {
            shakeRef.current = 20;
            const laneWidth = window.innerWidth / 4;
            const x = note.lane * laneWidth + laneWidth / 2;
            floatingTextsRef.current.push({
                id: Math.random(),
                x, y: window.innerHeight / 2,
                text: "MISS",
                life: 0.8,
                color: '#ef4444'
            });
        });

        engine.setOnComplete((success) => {
            if (success) {
                shakeRef.current = 0;
            } else {
                shakeRef.current = 30;
            }

            // Next Question Logic
            setTimeout(() => {
                setCurrentQIndex(prev => {
                    const next = prev + 1;
                    if (next < questions.length) {
                        engine.setQuestion(questions[next]);
                        engine.nextRound();
                        return next;
                    } else {
                        setIsPlaying(false);
                        onComplete(engine.getScore());
                        return prev;
                    }
                });
            }, 1000); 
        });

        engineRef.current = engine;
        setIsReady(true);

        return () => {
            engine.stop();
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []); 

    // Game Loop
    const animate = () => {
        if (!canvasRef.current || !engineRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Update Engine State
        engineRef.current.update(canvas.height);
        
        // Sync React State
        setScore(engineRef.current.getScore());
        setCombo(engineRef.current.getCombo());
        setMultiplier(engineRef.current.getMultiplier());
        setHealth(engineRef.current.getHealth());
        setPhase(engineRef.current.getPhase());

        // --- RENDER ---
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Apply Screen Shake
        let shakeX = 0;
        let shakeY = 0;
        if (shakeRef.current > 0) {
            shakeX = (Math.random() - 0.5) * shakeRef.current;
            shakeY = (Math.random() - 0.5) * shakeRef.current;
            shakeRef.current *= 0.9; // Decay
            if (shakeRef.current < 0.5) shakeRef.current = 0;
        }
        
        ctx.save();
        ctx.translate(shakeX, shakeY);

        // 1. Draw Lanes (Color Coded Backgrounds)
        const laneWidth = canvas.width / 4;
        const laneColors = [
            'rgba(239, 68, 68, 0.05)', // Red
            'rgba(59, 130, 246, 0.05)', // Blue
            'rgba(34, 197, 94, 0.05)', // Green
            'rgba(234, 179, 8, 0.05)'  // Yellow
        ];
        
        for (let i = 0; i < 4; i++) {
            // Lane Flash on Beat
            const audioData = engineRef.current.getAudioData();
            const bass = audioData[0] / 255;
            const flash = bass > 0.6 ? 0.1 : 0;
            
            ctx.fillStyle = laneColors[i].replace('0.05', `${0.05 + flash}`);
            ctx.fillRect(i * laneWidth, 0, laneWidth, canvas.height);
            
            // Draw Hit Line
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(i * laneWidth, canvas.height - 100, laneWidth, 4);
            
            // --- IMPROVED OPTION VISIBILITY ---
            // Draw Background Box for Option
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(i * laneWidth + 10, canvas.height - 80, laneWidth - 20, 60);
            
            // Option Text
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = 'bold 16px Inter';
            ctx.textAlign = 'center';
            
            const optText = currentQuestion.options[i];
            const shortOpt = optText.length > 25 ? optText.substring(0, 22) + '...' : optText;
            
            ctx.fillText(shortOpt, i * laneWidth + laneWidth/2, canvas.height - 45);
            
            // Key Label (A, B, C, D)
            ctx.font = '900 60px Inter';
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillText(['A', 'B', 'C', 'D'][i], i * laneWidth + laneWidth/2, canvas.height - 120);
        }

        // 2. Draw Notes
        const notes = engineRef.current.getNotes();
        notes.forEach(note => {
            if (note.isHit && !note.isHold) return; 
            if (note.isHit && note.isHold && note.holdProgress >= 1) return;

            const x = note.lane * laneWidth;
            const y = note.visualY;
            const w = laneWidth - 10; 
            const h = note.type === 'answer' ? 80 : 40; 

            const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308'];
            ctx.fillStyle = colors[note.lane];
            
            // --- HOLD NOTE DRAWING ---
            if (note.isHold) {
                // Draw Tail
                const tailHeight = 300; // Fixed visual height for hold
                const progressHeight = tailHeight * note.holdProgress;
                
                // Tail Background
                ctx.fillStyle = `${colors[note.lane]}44`; // Transparent
                ctx.fillRect(x + 10, y - tailHeight + h, w - 10, tailHeight);
                
                // Filled Progress
                ctx.fillStyle = `${colors[note.lane]}`;
                ctx.fillRect(x + 10, y - progressHeight + h, w - 10, progressHeight);
                
                // Head (The Note itself)
                ctx.fillStyle = '#fff';
                ctx.fillRect(x + 5, y, w, h);
                
                // Label
                ctx.fillStyle = '#000';
                ctx.font = 'bold 20px Inter';
                ctx.fillText("HOLD!", x + w/2, y + h/2 + 8);
                
                if (note.isHolding) {
                    // Glow effect when holding
                    ctx.shadowBlur = 30;
                    ctx.shadowColor = '#fff';
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(x + 5, y, w, h);
                    ctx.shadowBlur = 0;
                }
            } else {
                // --- TAP NOTE DRAWING ---
                ctx.shadowBlur = 20;
                ctx.shadowColor = colors[note.lane];
                ctx.fillRect(x + 5, y, w, h);
                ctx.shadowBlur = 0;
            }
        });

        // 3. Draw Particles
        particlesRef.current.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            p.vy += 0.5; // Gravity
            
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            
            if (p.life <= 0) particlesRef.current.splice(i, 1);
        });

        // 4. Draw Floating Text
        floatingTextsRef.current.forEach((t, i) => {
            t.y -= 1;
            t.life -= 0.02;
            
            ctx.globalAlpha = Math.max(0, t.life);
            ctx.fillStyle = t.color;
            ctx.font = '900 32px Inter';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeText(t.text, t.x, t.y);
            ctx.fillText(t.text, t.x, t.y);
            ctx.globalAlpha = 1;
            
            if (t.life <= 0) floatingTextsRef.current.splice(i, 1);
        });

        // 5. Chromatic Aberration (Glitch Effect on Low Health)
        if (health < 30) {
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
            ctx.fillRect(Math.random() * 10 - 5, Math.random() * 10 - 5, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
            ctx.fillRect(Math.random() * 10 - 5, Math.random() * 10 - 5, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.restore(); 

        requestRef.current = requestAnimationFrame(animate);
    };

    const handleStart = () => {
        if (engineRef.current) {
            engineRef.current.start();
            setIsPlaying(true);
            requestRef.current = requestAnimationFrame(animate);
        }
    };

    const handleLaneTap = (laneIndex: number, isDown: boolean) => {
        if (engineRef.current) {
            const res = engineRef.current.handleInput(laneIndex, isDown);
            if (res?.hit && isDown) {
                // Flash Lane Effect (handled in engine callback)
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col items-center justify-center overflow-hidden font-sans">
            {/* HUD */}
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 pointer-events-none">
                <div className="text-white">
                    <div className="text-5xl font-black italic tracking-tighter flex items-center gap-2" style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>
                        {score.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <div className="px-3 py-1 bg-yellow-400 text-black font-black text-sm rounded-full transform -skew-x-12">
                            {multiplier}X MULTIPLIER
                        </div>
                        {combo > 5 && (
                            <div className="text-cyan-400 font-black text-2xl italic animate-pulse">
                                {combo} COMBO!
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                    <button onClick={onExit} className="pointer-events-auto p-2 bg-white/10 rounded-full hover:bg-white/20 text-white mb-2">
                        <XCircle />
                    </button>
                    {/* Health Bar */}
                    <div className="w-48 h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-600 shadow-inner">
                        <motion.div 
                            className={`h-full ${health < 30 ? 'bg-red-600 animate-pulse' : 'bg-gradient-to-r from-red-500 to-green-500'}`}
                            animate={{ width: `${health}%` }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        />
                    </div>
                    <div className="flex items-center text-red-400 font-bold text-xs gap-1">
                        <Heart size={12} fill="currentColor" /> {Math.round(health)}%
                    </div>
                </div>
            </div>

            {/* PHASE INDICATOR & COMBO BAR */}
            <div className="absolute top-24 w-full text-center pointer-events-none z-10 flex flex-col items-center">
                <AnimatePresence mode='wait'>
                    {phase === 'HOOK' && (
                        <motion.h2 
                            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                            className="text-3xl md:text-5xl font-black text-white drop-shadow-2xl leading-tight max-w-4xl mx-auto px-4"
                        >
                            {currentQuestion.text}
                        </motion.h2>
                    )}
                    {phase === 'RUSH' && (
                        <motion.div 
                            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                            className="flex flex-col items-center gap-2"
                        >
                            <div className="text-cyan-300 font-bold tracking-[0.5em] text-sm bg-black/50 px-4 py-1 rounded-full backdrop-blur-md">
                                RHYTHM RUSH
                            </div>
                            
                            {/* COMBO PROGRESS BAR */}
                            <div className="bg-black/50 p-2 rounded-xl backdrop-blur-md border border-cyan-500/30">
                                <div className="text-xs text-cyan-400 font-bold mb-1 tracking-widest">
                                    CHARGE COMBO: {Math.min(combo, 10)} / 10
                                </div>
                                <div className="w-64 h-3 bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div 
                                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                        animate={{ width: `${Math.min((combo / 10) * 100, 100)}%` }}
                                    />
                                </div>
                                {combo < 10 && (
                                    <div className="text-[10px] text-red-400 mt-1 animate-pulse flex items-center justify-center gap-1">
                                        <Lock size={10} /> LOCKED
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                    {phase === 'VERDICT' && (
                        <motion.div 
                            initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            className="text-red-500 font-black text-6xl tracking-tighter drop-shadow-[0_0_30px_rgba(239,68,68,0.8)]"
                        >
                            HOLD ANSWER!
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* CANVAS LAYER */}
            <canvas 
                ref={canvasRef}
                width={window.innerWidth}
                height={window.innerHeight}
                className="absolute inset-0 w-full h-full"
            />

            {/* TOUCH LAYER (INVISIBLE CONTROLS) */}
            <div className="absolute inset-0 grid grid-cols-4 z-20">
                {[0, 1, 2, 3].map(i => (
                    <div 
                        key={i}
                        className="h-full border-r border-white/5 active:bg-white/10 transition-colors cursor-pointer"
                        onTouchStart={(e) => { e.preventDefault(); handleLaneTap(i, true); }}
                        onTouchEnd={(e) => { e.preventDefault(); handleLaneTap(i, false); }}
                        onMouseDown={() => handleLaneTap(i, true)}
                        onMouseUp={() => handleLaneTap(i, false)}
                        onMouseLeave={() => handleLaneTap(i, false)}
                    />
                ))}
            </div>

            {/* START OVERLAY */}
            {!isPlaying && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-30 flex items-center justify-center">
                    <div className="text-center max-w-lg px-6">
                        <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 mb-2 italic tracking-tighter">
                            SYNAPSE 2.0
                        </h1>
                        <p className="text-cyan-200 font-bold tracking-widest text-xs mb-8">THE JUICE UPDATE</p>
                        
                        <div className="space-y-4 text-left bg-white/5 p-6 rounded-2xl border border-white/10 mb-8">
                            <div className="flex items-center gap-3 text-slate-300">
                                <span className="bg-cyan-500/20 text-cyan-400 p-2 rounded-lg"><Zap size={20}/></span>
                                <div>
                                    <strong className="text-white block">Fase 1: Rhythm Rush</strong>
                                    <span className="text-sm">Tap note biru untuk kumpulkan 10 COMBO agar bisa menjawab!</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-slate-300">
                                <span className="bg-red-500/20 text-red-400 p-2 rounded-lg"><Lock size={20}/></span>
                                <div>
                                    <strong className="text-white block">Fase 2: The Verdict</strong>
                                    <span className="text-sm">HOLD (Tahan) tombol jawaban yang benar sampai penuh!</span>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={handleStart}
                            disabled={!isReady}
                            className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-black text-2xl shadow-xl shadow-indigo-500/30 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                        >
                            <Play fill="currentColor" /> START ENGINE
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
