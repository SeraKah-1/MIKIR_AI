
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Key, Database, FileCode, Lock, CreditCard, User, Check, Zap, Cpu, Server, Copy } from 'lucide-react';
import { generateKeycard } from '../services/keycardService';
import { getApiKey, getSupabaseConfig } from '../services/storageService';
import { AiProvider } from '../types';

interface AdminGeneratorProps {
  onClose: () => void;
}

export const AdminGenerator: React.FC<AdminGeneratorProps> = ({ onClose }) => {
  // Card Metadata
  const [owner, setOwner] = useState('');
  const [pin, setPin] = useState('123456'); // Default easy PIN
  const [expiryDays, setExpiryDays] = useState(30);
  
  // Capabilities Checklist
  const [includeGemini, setIncludeGemini] = useState(false);
  const [includeGroq, setIncludeGroq] = useState(false);
  const [includeSupabase, setIncludeSupabase] = useState(false);

  // Key Values (Manual Input by default)
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');

  // Helper to load admin's personal keys only if they want to
  const loadMyKeys = (type: 'gemini' | 'groq' | 'supabase') => {
    if (type === 'gemini') {
        const key = getApiKey('gemini');
        if (key) setGeminiKey(key);
    } else if (type === 'groq') {
        const key = getApiKey('groq');
        if (key) setGroqKey(key);
    } else if (type === 'supabase') {
        const config = getSupabaseConfig();
        if (config) {
            setSupabaseUrl(config.url);
            setSupabaseKey(config.key);
        }
    }
  };

  const handleGenerate = () => {
    if (!owner) {
      alert("Masukkan nama User/Kelas terlebih dahulu.");
      return;
    }
    if (!pin) {
      alert("PIN wajib diisi.");
      return;
    }
    if (!includeGemini && !includeGroq) {
      alert("Pilih minimal satu Provider AI (Gemini atau Groq).");
      return;
    }
    
    // Validation: If checked, must have value
    if (includeGemini && !geminiKey) { alert("Gemini Key dipilih tapi kosong!"); return; }
    if (includeGroq && !groqKey) { alert("Groq Key dipilih tapi kosong!"); return; }
    if (includeSupabase && (!supabaseUrl || !supabaseKey)) { alert("Supabase config tidak lengkap!"); return; }

    try {
      const encryptedString = generateKeycard(pin, {
        metadata: {
          owner,
          created_at: Date.now(),
          expires_at: Date.now() + (expiryDays * 24 * 60 * 60 * 1000),
        },
        config: {
          geminiKey: includeGemini ? geminiKey : undefined,
          groqKey: includeGroq ? groqKey : undefined,
          preferredProvider: includeGemini ? 'gemini' : 'groq', 
          supabaseUrl: includeSupabase ? supabaseUrl : undefined,
          supabaseKey: includeSupabase ? supabaseKey : undefined
        }
      });

      // Download File
      // FIX: Use application/octet-stream to force browser to respect .mikir extension
      const blob = new Blob([encryptedString], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${owner.replace(/\s+/g, '_').toLowerCase()}.mikir`;
      document.body.appendChild(a); // Append to body for Firefox support
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert(`Kartu .mikir untuk "${owner}" berhasil dibuat!`);
      onClose();
    } catch (e) {
      alert("Gagal membuat kartu. Cek data kembali.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-sm text-slate-800">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl bg-white rounded-[2rem] p-0 shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20"><CreditCard className="text-white" /></div>
             <div>
               <h2 className="text-2xl font-bold text-slate-800">Card Studio</h2>
               <p className="text-slate-500 text-sm">Issue Access for Gaptek Users</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="text-slate-500" /></button>
        </div>

        {/* Scrollable Content */}
        <div className="p-8 overflow-y-auto custom-scrollbar space-y-8 flex-1">
           
           {/* Section 1: User Identity */}
           <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                 <User className="text-indigo-500" size={18} />
                 <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">User Identity</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="text-slate-600 text-xs font-bold block mb-2 ml-1">Card Owner Name</label>
                    <input 
                      type="text" 
                      value={owner} 
                      onChange={e => setOwner(e.target.value)} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 outline-none" 
                      placeholder="e.g. Dr. Strange / Kelas X" 
                      autoFocus
                    />
                 </div>
                 <div>
                    <label className="text-slate-600 text-xs font-bold block mb-2 ml-1">Unlock PIN (Passphrase)</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-3.5 text-slate-400" />
                      <input 
                        type="text" 
                        value={pin} 
                        onChange={e => setPin(e.target.value)} 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-800 font-mono tracking-widest focus:ring-2 focus:ring-indigo-500 outline-none" 
                        placeholder="123456" 
                      />
                    </div>
                 </div>
              </div>
           </section>

           <hr className="border-slate-100" />

           {/* Section 2: Embed Capabilities */}
           <section className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                 <Zap className="text-amber-500" size={18} />
                 <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Embed API Keys</h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                 Paste key manual untuk User, atau klik ikon <Copy size={10} className="inline" /> untuk ambil dari browser-mu.
              </p>

              {/* Gemini */}
              <div className={`p-4 rounded-xl border transition-all ${includeGemini ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 opacity-70'}`}>
                 <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                       <input type="checkbox" checked={includeGemini} onChange={e => setIncludeGemini(e.target.checked)} className="w-5 h-5 accent-indigo-600 rounded cursor-pointer" />
                       <span className="font-bold text-slate-700">Google Gemini</span>
                    </div>
                    {includeGemini && (
                        <button onClick={() => loadMyKeys('gemini')} className="text-[10px] flex items-center bg-indigo-100 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-200">
                           <Copy size={10} className="mr-1" /> Load Mine
                        </button>
                    )}
                 </div>
                 {includeGemini && (
                   <input 
                      type="text" 
                      value={geminiKey} 
                      onChange={e => setGeminiKey(e.target.value)} 
                      placeholder="Paste Gemini API Key for this user..."
                      className="w-full text-xs p-2 rounded border border-indigo-200 bg-white font-mono text-indigo-800"
                   />
                 )}
              </div>

              {/* Groq */}
              <div className={`p-4 rounded-xl border transition-all ${includeGroq ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200 opacity-70'}`}>
                 <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                       <input type="checkbox" checked={includeGroq} onChange={e => setIncludeGroq(e.target.checked)} className="w-5 h-5 accent-orange-600 rounded cursor-pointer" />
                       <span className="font-bold text-slate-700">Groq Cloud</span>
                    </div>
                     {includeGroq && (
                        <button onClick={() => loadMyKeys('groq')} className="text-[10px] flex items-center bg-orange-100 text-orange-600 px-2 py-1 rounded hover:bg-orange-200">
                           <Copy size={10} className="mr-1" /> Load Mine
                        </button>
                    )}
                 </div>
                 {includeGroq && (
                   <input 
                      type="text" 
                      value={groqKey} 
                      onChange={e => setGroqKey(e.target.value)} 
                      placeholder="Paste Groq API Key for this user..."
                      className="w-full text-xs p-2 rounded border border-orange-200 bg-white font-mono text-orange-800"
                   />
                 )}
              </div>
           </section>

           {/* Section 3: Database */}
           <section className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                 <Server className="text-emerald-500" size={18} />
                 <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Storage</h3>
              </div>

              <div className={`p-4 rounded-xl border transition-all ${includeSupabase ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 opacity-70'}`}>
                 <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                       <input 
                          type="checkbox" 
                          checked={includeSupabase} 
                          onChange={e => setIncludeSupabase(e.target.checked)} 
                          className="w-5 h-5 accent-emerald-600 rounded cursor-pointer" 
                       />
                       <div>
                          <span className="font-bold text-slate-700 block">Connect Supabase</span>
                          <span className="text-xs text-slate-500">Enable Cloud History</span>
                       </div>
                    </div>
                    {includeSupabase && (
                        <button onClick={() => loadMyKeys('supabase')} className="text-[10px] flex items-center bg-emerald-100 text-emerald-600 px-2 py-1 rounded hover:bg-emerald-200">
                           <Copy size={10} className="mr-1" /> Load Mine
                        </button>
                    )}
                 </div>
                 {includeSupabase && (
                    <div className="space-y-2">
                        <input 
                            type="text" 
                            value={supabaseUrl} 
                            onChange={e => setSupabaseUrl(e.target.value)} 
                            placeholder="Supabase Project URL"
                            className="w-full text-xs p-2 rounded border border-emerald-200 bg-white font-mono text-emerald-800"
                        />
                         <input 
                            type="text" 
                            value={supabaseKey} 
                            onChange={e => setSupabaseKey(e.target.value)} 
                            placeholder="Supabase Anon Key"
                            className="w-full text-xs p-2 rounded border border-emerald-200 bg-white font-mono text-emerald-800"
                        />
                    </div>
                 )}
              </div>
           </section>

        </div>

        {/* Footer Action */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
           <div className="text-xs text-slate-400">
             Expires in: 
             <input 
               type="number" 
               value={expiryDays} 
               onChange={e => setExpiryDays(Number(e.target.value))} 
               className="w-12 ml-2 p-1 border rounded text-center bg-white" 
             /> Days
           </div>
           <button 
             onClick={handleGenerate} 
             className="px-8 py-3 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl font-bold flex items-center shadow-lg transition-all active:scale-95"
           >
              <CreditCard className="mr-2" size={18} /> Issue Keycard
           </button>
        </div>
      </motion.div>
    </div>
  );
};
