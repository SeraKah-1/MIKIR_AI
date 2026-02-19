
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Lock, Unlock, Upload, AlertCircle, ShieldCheck, ShieldAlert, ArrowRight } from 'lucide-react';
import { unlockKeycard, applyKeycardToSession } from '../services/keycardService';
import { AdminGenerator } from './AdminGenerator';

interface LoginGateProps {
  onUnlock: () => void;
}

// DEFAULT PASSWORD FALLBACK
// Setup Environment Variable: NEXT_PUBLIC_ADMIN_PASSWORD di Vercel untuk mengganti ini.
const DEFAULT_ADMIN_PASS = "mikir123";

export const LoginGate: React.FC<LoginGateProps> = ({ onUnlock }) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  
  // ADMIN STATES
  const [logoClicks, setLogoClicks] = useState(0);
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [showAdminTool, setShowAdminTool] = useState(false);

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
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (f: File) => {
    // FIX: Allow .txt as well, as some browsers rename downloaded files.
    // The strict check happens inside unlockKeycard() via "MIKIRCARDv1|" signature.
    const validExtensions = ['.mikir', '.glasscard', '.txt'];
    const hasValidExt = validExtensions.some(ext => f.name.endsWith(ext));

    if (!hasValidExt) {
      setError("Format file salah. Gunakan file .mikir");
      return;
    }
    setFile(f);
    setError(null);
    setShowPinInput(true);
  };

  const handleUnlock = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const keycardData = unlockKeycard(content, pin);
        
        // Success
        applyKeycardToSession(keycardData);
        
        // Add fake delay for effect
        setTimeout(() => {
          onUnlock();
        }, 800);
      } catch (err: any) {
        setError(err.message || "Gagal membuka kartu.");
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleLogoClick = () => {
    setLogoClicks(prev => {
      const newCount = prev + 1;
      if (newCount === 5) {
        setShowAdminAuth(true); // Show Password Prompt instead of direct tool
        return 0;
      }
      return newCount;
    });
  };

  const verifyAdmin = () => {
    const secret = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || DEFAULT_ADMIN_PASS;
    if (adminPassInput === secret) {
       setShowAdminAuth(false);
       setShowAdminTool(true);
       setAdminPassInput('');
    } else {
       setError("Password Admin Salah!");
       setTimeout(() => setError(null), 2000);
    }
  };

  if (showAdminTool) {
    return <AdminGenerator onClose={() => setShowAdminTool(false)} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full bg-slate-900 z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px] animate-pulse" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] p-8 shadow-2xl shadow-black/50 overflow-hidden relative">
          
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div 
              onClick={handleLogoClick}
              whileTap={{ scale: 0.9 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg mb-4 cursor-pointer select-none"
            >
              <Lock className="text-white" size={32} />
            </motion.div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Access Control</h1>
            <p className="text-indigo-200 text-sm mt-2">Insert Keycard (.mikir) to Initialize</p>
          </div>

          {/* ADMIN AUTH OVERLAY */}
          <AnimatePresence>
            {showAdminAuth && (
              <motion.div 
                 initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                 animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
                 exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                 className="absolute inset-0 z-50 bg-slate-900/80 flex flex-col items-center justify-center p-6"
              >
                 <ShieldAlert className="text-rose-500 mb-4" size={48} />
                 <h3 className="text-white font-bold text-lg mb-2">Restricted Area</h3>
                 <p className="text-slate-400 text-xs text-center mb-6">Enter Admin Secret to access Card Generator.</p>
                 
                 <div className="w-full relative">
                    <input 
                      type="password" 
                      value={adminPassInput}
                      onChange={(e) => setAdminPassInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && verifyAdmin()}
                      placeholder="Admin Password..."
                      autoFocus
                      className="w-full bg-black/40 border border-white/20 rounded-xl px-4 py-3 text-white text-center focus:outline-none focus:border-rose-500 transition-all"
                    />
                    <button 
                      onClick={verifyAdmin}
                      className="absolute right-2 top-2 p-1.5 bg-rose-600 rounded-lg text-white hover:bg-rose-500"
                    >
                      <ArrowRight size={16} />
                    </button>
                 </div>
                 <button onClick={() => setShowAdminAuth(false)} className="mt-4 text-xs text-slate-500 hover:text-white underline">Cancel</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Upload Area */}
          <AnimatePresence mode='wait'>
            {!showPinInput ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`
                  relative h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer group
                  ${dragActive ? 'border-indigo-400 bg-indigo-500/20' : 'border-white/20 hover:border-white/40 hover:bg-white/5'}
                `}
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                onClick={() => document.getElementById('keycard-upload')?.click()}
              >
                <input id="keycard-upload" type="file" accept=".mikir,.glasscard,.txt" className="hidden" onChange={handleFileChange} />
                <div className="p-4 bg-white/10 rounded-full mb-3 group-hover:scale-110 transition-transform">
                  <CreditCard className="text-white" size={32} />
                </div>
                <p className="text-white font-medium">Drop Keycard Here</p>
                <p className="text-white/40 text-xs mt-1">.mikir or .glasscard</p>
              </motion.div>
            ) : (
              <motion.div
                key="pin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-3">
                   <div className="p-2 bg-emerald-500/20 rounded-lg mr-3">
                     <ShieldCheck className="text-emerald-400" size={20} />
                   </div>
                   <div className="flex-1 overflow-hidden">
                     <p className="text-white text-sm font-bold truncate">{file?.name}</p>
                     <p className="text-white/40 text-xs">Ready to decrypt</p>
                   </div>
                   <button onClick={() => { setShowPinInput(false); setFile(null); }} className="text-white/40 hover:text-white">
                      <AlertCircle size={16} />
                   </button>
                </div>

                <div>
                   <label className="text-white/60 text-xs font-bold uppercase tracking-wider mb-2 block">Security PIN</label>
                   <input 
                     autoFocus
                     type="password" 
                     value={pin}
                     onChange={(e) => setPin(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                     placeholder="Enter PIN..."
                     className="w-full bg-black/30 border border-white/20 rounded-xl px-4 py-3 text-white text-center text-lg tracking-[0.5em] focus:outline-none focus:border-indigo-500 transition-colors placeholder:tracking-normal placeholder:text-sm"
                   />
                </div>

                <button 
                  onClick={handleUnlock}
                  disabled={!pin || isLoading}
                  className={`
                    w-full py-4 rounded-xl font-bold text-white shadow-lg flex items-center justify-center transition-all
                    ${isLoading ? 'bg-indigo-600/50 cursor-wait' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-indigo-500/25 active:scale-95'}
                  `}
                >
                  {isLoading ? (
                    <span className="animate-pulse">DECRYPTING...</span>
                  ) : (
                    <>
                      <Unlock size={18} className="mr-2" /> UNLOCK SYSTEM
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 bg-rose-500/20 border border-rose-500/40 p-3 rounded-xl flex items-center text-rose-200 text-xs">
                <AlertCircle size={14} className="mr-2 shrink-0" /> {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-6 text-center">
           <p className="text-white/20 text-[10px] uppercase tracking-widest font-bold">Secure Access System v1.0</p>
        </div>
      </motion.div>
    </div>
  );
};
