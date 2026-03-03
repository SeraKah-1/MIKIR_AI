

import { Question } from '../types';

export interface SynapseConfig {
    bpm: number;
    noteSpeed: number; // Pixels per second
    laneCount: number;
    audioUrl?: string; // Optional user uploaded audio
}

export type NoteType = 'tap' | 'answer';

export interface Note {
    id: string;
    lane: number; // 0-3
    time: number; // Time in seconds when it should be hit
    type: NoteType;
    isHit: boolean;
    isMissed: boolean;
    visualY: number; // Current Y position for rendering
    label?: string; // For Answer notes (A, B, C, D)
    
    // Hold Note Properties
    isHold: boolean;
    duration: number; // Duration in seconds
    isHolding: boolean; // Is currently being held?
    holdProgress: number; // 0 to 1
}

export class SynapseEngine {
    private audioContext: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private analyserNode: AnalyserNode | null = null;
    
    // Procedural Audio State
    private nextNoteTime: number = 0;
    private beatCount: number = 0;
    
    private startTime: number = 0;
    private isPlaying: boolean = false;
    private notes: Note[] = [];
    private score: number = 0;
    private combo: number = 0;
    private multiplier: number = 1;
    private health: number = 100;
    
    private config: SynapseConfig;
    private question: Question | null = null; // Current Question Context
    
    private onHitCallback?: (note: Note, rating: 'perfect' | 'good' | 'bad') => void;
    private onMissCallback?: (note: Note) => void;
    private onCompletionCallback?: (success: boolean) => void;

    // Game Loop State
    private phase: 'HOOK' | 'RUSH' | 'VERDICT' | 'RESULT' = 'HOOK';
    private hasSpawnedVerdict: boolean = false;
    private heldLanes: boolean[] = [false, false, false, false];
    
    // Combo Requirement
    private readonly TARGET_COMBO = 10;

    constructor(config: SynapseConfig) {
        this.config = config;
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.5;
        this.masterGain.connect(this.audioContext.destination);

        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 256; 
        this.masterGain.connect(this.analyserNode);
    }

    public setQuestion(q: Question) {
        this.question = q;
    }

    // --- PROCEDURAL AUDIO SYNTHESIZER ---
    private scheduleSound() {
        if (!this.audioContext || !this.masterGain) return;
        
        const secondsPerBeat = 60.0 / this.config.bpm;
        const lookahead = 0.1; 

        while (this.nextNoteTime < this.audioContext.currentTime + lookahead) {
            this.playBeat(this.nextNoteTime, this.beatCount);
            this.nextNoteTime += secondsPerBeat / 4; // 16th notes
            this.beatCount++;
        }
        
        if (this.isPlaying) {
            requestAnimationFrame(() => this.scheduleSound());
        }
    }

    private playBeat(time: number, beat: number) {
        if (!this.audioContext || !this.masterGain) return;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        const sixteenth = beat % 16;
        const quarter = beat % 4;

        // --- SPAWN LOGIC (Denser & More Interactive) ---
        if (this.phase === 'RUSH') {
             const spawnDelay = 2.0; // Time for note to travel
             
             // 1. Heavy Beat (Kick/Snare) - High Chance
             if (quarter === 0) {
                 this.spawnNote(time + spawnDelay, 'tap');
             }
             
             // 2. Off-beat (8th note) - Medium Chance
             else if (quarter === 2 && Math.random() > 0.3) {
                 this.spawnNote(time + spawnDelay, 'tap');
             }
             
             // 3. Fills (16th notes) - Low Chance (Trills)
             else if (Math.random() > 0.85) {
                 this.spawnNote(time + spawnDelay, 'tap');
             }
        }

        // --- AUDIO SYNTHESIS ---

        // 1. KICK (Every Quarter Note - Beat 1 & 3)
        if (quarter === 0 && (sixteenth < 8)) { // Kick on 1
            osc.frequency.setValueAtTime(150, time);
            osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
            gain.gain.setValueAtTime(1, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
            osc.start(time);
            osc.stop(time + 0.5);
        }
        
        // 2. SNARE (Every Quarter Note - Beat 2 & 4)
        if (quarter === 0 && (sixteenth >= 8)) { // Snare on 2 & 4
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, time);
            gain.gain.setValueAtTime(0.8, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
            
            // Noise burst for snare
            const noiseOsc = this.audioContext.createOscillator();
            const noiseGain = this.audioContext.createGain();
            noiseOsc.type = 'sawtooth'; // Rough approx
            noiseOsc.frequency.value = 800;
            noiseOsc.connect(noiseGain);
            noiseGain.connect(this.masterGain);
            noiseGain.gain.setValueAtTime(0.5, time);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
            noiseOsc.start(time);
            noiseOsc.stop(time + 0.1);
            
            osc.start(time);
            osc.stop(time + 0.2);
        }
        
        // 3. HI-HAT (Every 8th note)
        if (quarter % 2 === 0) {
            const hatOsc = this.audioContext.createOscillator();
            const hatGain = this.audioContext.createGain();
            hatOsc.connect(hatGain);
            hatGain.connect(this.masterGain);
            
            hatOsc.type = 'square';
            hatOsc.frequency.setValueAtTime(800 + Math.random() * 200, time);
            hatGain.gain.setValueAtTime(0.15, time);
            hatGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
            hatOsc.start(time);
            hatOsc.stop(time + 0.05);
        }

        // 4. BASSLINE / MELODY (Synthwave Arp)
        if (this.phase === 'RUSH') {
             osc.type = 'sawtooth';
             // Am7 - Fmaj7 - Cmaj7 - G7 Progression
             const progression = [
                 [110, 130, 164, 196], // Am7
                 [87, 110, 130, 174],  // Fmaj7
                 [130, 164, 196, 246], // Cmaj7
                 [98, 123, 146, 196]   // G7
             ];
             
             // Change chord every 4 beats (16 sixteenths)
             const chordIndex = Math.floor(beat / 16) % 4;
             const currentChord = progression[chordIndex];
             const note = currentChord[sixteenth % 4];
             
             if (sixteenth % 2 === 0) { // 8th notes
                 osc.frequency.setValueAtTime(note, time);
                 gain.gain.setValueAtTime(0.15, time);
                 gain.gain.linearRampToValueAtTime(0, time + 0.15);
                 osc.start(time);
                 osc.stop(time + 0.15);
             }
        }
    }

    // --- SFX ---
    public playSFX(type: 'hit' | 'miss' | 'hold_tick') {
        if (!this.audioContext || !this.masterGain) return;
        const t = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        if (type === 'hit') {
            // Musical Hit Sound (Pentatonic Scale)
            osc.type = 'triangle';
            const scale = [440, 523.25, 587.33, 659.25, 783.99]; // A Minor Pentatonic
            const note = scale[Math.floor(Math.random() * scale.length)];
            
            osc.frequency.setValueAtTime(note, t);
            osc.frequency.exponentialRampToValueAtTime(note * 2, t + 0.1); // Pitch bend up
            
            gain.gain.setValueAtTime(0.4, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            
            osc.start(t);
            osc.stop(t + 0.15);
        } else if (type === 'miss') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, t);
            osc.frequency.linearRampToValueAtTime(50, t + 0.3);
            gain.gain.setValueAtTime(0.5, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.3);
            osc.start(t);
            osc.stop(t + 0.3);
        } else if (type === 'hold_tick') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, t); // Higher pitch for hold
            gain.gain.setValueAtTime(0.05, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
            osc.start(t);
            osc.stop(t + 0.05);
        }
    }

    public start() {
        if (!this.audioContext) return;
        if (this.audioContext.state === 'suspended') this.audioContext.resume();

        this.startTime = this.audioContext.currentTime;
        this.nextNoteTime = this.startTime + 0.5; 
        this.isPlaying = true;
        this.score = 0;
        this.combo = 0;
        this.health = 100;
        this.notes = [];
        this.phase = 'HOOK';
        this.hasSpawnedVerdict = false;
        this.heldLanes = [false, false, false, false];

        // Start Sound
        this.playSFX('hit'); 
        
        this.scheduleSound();
    }

    public nextRound() {
        if (!this.audioContext) return;
        this.startTime = this.audioContext.currentTime;
        this.phase = 'HOOK';
        this.hasSpawnedVerdict = false;
        this.notes = []; 
        this.heldLanes = [false, false, false, false];
    }

    public stop() {
        this.isPlaying = false;
        if (this.audioContext) this.audioContext.suspend();
    }

    public update(canvasHeight: number) {
        if (!this.isPlaying || !this.audioContext) return;

        const currentTime = this.audioContext.currentTime - this.startTime;

        // --- PHASE LOGIC ---
        if (currentTime < 2.5) {
            this.phase = 'HOOK';
        } else if (!this.hasSpawnedVerdict) {
            // RUSH PHASE
            this.phase = 'RUSH';
            
            // Check if we can transition to VERDICT
            // Must have enough combo AND enough time passed (e.g. 8s)
            if (currentTime >= 8.0 && this.combo >= this.TARGET_COMBO) {
                this.phase = 'VERDICT';
                this.spawnVerdictNotes(currentTime + 2.0); 
                this.hasSpawnedVerdict = true;
            }
        }

        // --- UPDATE NOTES ---
        this.notes.forEach(note => {
            const timeDiff = note.time - currentTime; 
            const targetY = canvasHeight - 100;
            note.visualY = targetY - (timeDiff * this.config.noteSpeed);

            // HOLD NOTE LOGIC
            if (note.isHold && note.isHolding) {
                // If holding, keep visualY at hit line
                note.visualY = targetY;
                
                // Increment Progress
                note.holdProgress += 0.02; // Approx 60fps -> 50 frames = ~1s
                if (Math.random() > 0.8) this.playSFX('hold_tick');

                // Check Completion
                if (note.holdProgress >= 1.0) {
                    this.completeHold(note);
                }
            }

            // Miss Detection (Tap Notes)
            if (!note.isHold && timeDiff < -0.2 && !note.isHit && !note.isMissed) {
                note.isMissed = true;
                this.handleMiss(note);
            }
            
            // Miss Detection (Hold Notes - if passed without holding)
            if (note.isHold && timeDiff < -0.2 && !note.isHolding && !note.isHit && !note.isMissed) {
                note.isMissed = true;
                this.handleMiss(note);
            }
        });

        // Cleanup
        this.notes = this.notes.filter(n => !n.isMissed || (n.isMissed && n.visualY < canvasHeight + 200));
        this.notes = this.notes.filter(n => !(n.isHit && !n.isHold) && !(n.isHit && n.isHold && n.holdProgress >= 1));
    }

    private spawnNote(targetTime: number, type: NoteType, lane?: number, label?: string) {
        const finalLane = lane !== undefined ? lane : Math.floor(Math.random() * this.config.laneCount);
        this.notes.push({
            id: Math.random().toString(36).substr(2, 9),
            lane: finalLane,
            time: targetTime,
            type,
            isHit: false,
            isMissed: false,
            visualY: -100,
            label,
            isHold: false,
            duration: 0,
            isHolding: false,
            holdProgress: 0
        });
    }

    private spawnVerdictNotes(targetTime: number) {
        // Spawn 4 HOLD notes for A, B, C, D
        for (let i = 0; i < 4; i++) {
            const note: Note = {
                id: Math.random().toString(36).substr(2, 9),
                lane: i,
                time: targetTime,
                type: 'answer',
                isHit: false,
                isMissed: false,
                visualY: -100,
                label: ['A', 'B', 'C', 'D'][i],
                isHold: true,
                duration: 2.0, // 2 Seconds Hold
                isHolding: false,
                holdProgress: 0
            };
            this.notes.push(note);
        }
    }

    public handleInput(lane: number, isDown: boolean) {
        if (!this.isPlaying || !this.audioContext) return;
        
        this.heldLanes[lane] = isDown;
        const currentTime = this.audioContext.currentTime - this.startTime;
        const hitWindow = 0.3; 

        if (isDown) {
            // TAP / START HOLD
            const note = this.notes.find(n => 
                n.lane === lane && 
                !n.isHit && 
                !n.isMissed && 
                Math.abs(n.time - currentTime) < hitWindow
            );

            if (note) {
                if (note.isHold) {
                    note.isHolding = true;
                    return { hit: true, rating: 'good', note };
                } else {
                    // Normal Tap
                    const diff = Math.abs(note.time - currentTime);
                    let rating: 'perfect' | 'good' | 'bad' = 'bad';
                    if (diff < 0.05) rating = 'perfect';
                    else if (diff < 0.1) rating = 'good';
                    
                    this.handleHit(note, rating);
                    return { hit: true, rating, note };
                }
            }
        } else {
            // RELEASE HOLD
            const holdingNote = this.notes.find(n => n.lane === lane && n.isHold && n.isHolding);
            if (holdingNote) {
                holdingNote.isHolding = false;
                // If released early, it's a miss? Or just stop progress?
                // Let's make it strict: Release early = Miss
                if (holdingNote.holdProgress < 0.9) {
                    this.handleMiss(holdingNote);
                }
            }
        }
        
        return { hit: false };
    }

    private completeHold(note: Note) {
        note.isHit = true;
        note.isHolding = false;
        
        if (note.type === 'answer') {
            if (this.question && note.lane === this.question.correctIndex) {
                this.handleHit(note, 'perfect');
                setTimeout(() => { if (this.onCompletionCallback) this.onCompletionCallback(true); }, 200);
            } else {
                this.handleMiss(note);
                setTimeout(() => { if (this.onCompletionCallback) this.onCompletionCallback(false); }, 200);
            }
        }
    }

    private handleHit(note: Note, rating: 'perfect' | 'good' | 'bad') {
        note.isHit = true;
        this.combo++;
        this.multiplier = Math.min(8, 1 + Math.floor(this.combo / 10));
        
        let points = 100;
        if (rating === 'perfect') points = 300;
        else if (rating === 'good') points = 200;
        
        this.score += points * this.multiplier;
        this.playSFX('hit');
        
        if (this.onHitCallback) this.onHitCallback(note, rating);
    }

    private handleMiss(note: Note) {
        this.combo = 0;
        this.multiplier = 1;
        this.health = Math.max(0, this.health - 10);
        this.playSFX('miss');
        
        if (this.onMissCallback) this.onMissCallback(note);

        if (this.health <= 0) {
            // Game Over for this round
            setTimeout(() => {
                if (this.onCompletionCallback) this.onCompletionCallback(false);
            }, 500);
        }
    }

    // Getters
    public getNotes() { return this.notes; }
    public getScore() { return this.score; }
    public getCombo() { return this.combo; }
    public getMultiplier() { return this.multiplier; }
    public getHealth() { return this.health; }
    public getPhase() { return this.phase; }
    public getTargetCombo() { return this.TARGET_COMBO; }
    public getAudioData() { 
        if (!this.analyserNode) return new Uint8Array(0);
        const arr = new Uint8Array(this.analyserNode.frequencyBinCount);
        this.analyserNode.getByteFrequencyData(arr);
        return arr;
    }

    // Setters
    public setOnHit(cb: (n: Note, r: 'perfect'|'good'|'bad') => void) { this.onHitCallback = cb; }
    public setOnMiss(cb: (n: Note) => void) { this.onMissCallback = cb; }
    public setOnComplete(cb: (s: boolean) => void) { this.onCompletionCallback = cb; }
}
