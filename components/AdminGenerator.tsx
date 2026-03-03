
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Key, Database, FileCode, Lock, CreditCard, User, Check, Zap, Cpu, Server, Copy, Upload, FileText, ArrowRight, RefreshCw, Fingerprint } from 'lucide-react';
import { generateKeycard, unlockKeycard } from '../services/keycardService';
import { getApiKey, getSupabaseConfig, generateId } from '../services/storageService';
import { MikirCloud } from '../services/supabaseService';
import { AiProvider } from '../types';

interface AdminGeneratorProps {
  onClose: () => void;
}

export const AdminGenerator: React.FC<AdminGeneratorProps> = ({ onClose }) => {
  // MODE: CREATE or EDIT or DASHBOARD
  const [mode, setMode] = useState<'create' | 'edit' | 'dashboard'>('create');

  // DASHBOARD STATE
  const [stats, setStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // EDIT STATE
  const [fileToEdit, setFileToEdit] = useState<File | null>(null);
  const [unlockPin, setUnlockPin] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [existingId, setExistingId] = useState<string | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);

  // Card Metadata (Form State)
  const [owner, setOwner] = useState('');
  const [pin, setPin] = useState('123456'); // Default easy PIN
  const [expiryDays, setExpiryDays] = useState(30);
  
  // Capabilities Checklist
  const [selectedProvider, setSelectedProvider] = useState<'gemini' | 'groq'>('gemini');
  const [includeSupabase, setIncludeSupabase] = useState(false);

  // Key Values (Manual Input by default)
  const [geminiKeys, setGeminiKeys] = useState(''); // Textarea content (one per line)
  const [groqKeys, setGroqKeys] = useState('');   // Textarea content (one per line)
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');

  // Helper to load admin's personal keys only if they want to
  const loadMyKeys = (type: 'gemini' | 'groq' | 'supabase') => {
    if (type === 'gemini') {
        const key = getApiKey('gemini');
        if (key) setGeminiKeys(key);
    } else if (type === 'groq') {
        const key = getApiKey('groq');
        if (key) setGroqKeys(key);
    } else if (type === 'supabase') {
        const config = getSupabaseConfig();
        if (config) {
            setSupabaseUrl(config.url);
            setSupabaseKey(config.key);
        }
    }
  };

  const handleLoadCard = () => {
    if (!fileToEdit || !unlockPin) {
      alert("Pilih file .mikir dan masukkan PIN lama.");
      return;
    }

    setIsUnlocking(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = unlockKeycard(content, unlockPin);
        
        // POPULATE FORM
        setOwner(data.metadata.owner);
        setPin(unlockPin); // Pre-fill with old PIN
        setExistingId(data.id); // Capture existing ID
        
        // Calculate remaining days
        if (data.metadata.expires_at) {
          const diffTime = Math.abs(data.metadata.expires_at - Date.now());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          setExpiryDays(diffDays > 0 ? diffDays : 30);
        }

        // Keys - Determine Provider
        if (data.config.geminiKeys && data.config.geminiKeys.length > 0) {
           setSelectedProvider('gemini');
           setGeminiKeys(data.config.geminiKeys.join('\n'));
           setGroqKeys(''); // Clear other
        } else if (data.config.geminiKey) {
           setSelectedProvider('gemini');
           setGeminiKeys(data.config.geminiKey);
           setGroqKeys('');
        } else if (data.config.groqKeys && data.config.groqKeys.length > 0) {
           setSelectedProvider('groq');
           setGroqKeys(data.config.groqKeys.join('\n'));
           setGeminiKeys('');
        } else if (data.config.groqKey) {
           setSelectedProvider('groq');
           setGroqKeys(data.config.groqKey);
           setGeminiKeys('');
        } else {
           // Default fallback
           setSelectedProvider('gemini');
        }

        if (data.config.supabaseUrl) {
          setIncludeSupabase(true);
          setSupabaseUrl(data.config.supabaseUrl);
          setSupabaseKey(data.config.supabaseKey || '');
        } else {
          setIncludeSupabase(false);
          setSupabaseUrl('');
          setSupabaseKey('');
        }

        // Switch UI to Create/Edit Form
        setMode('create');
        alert("Kartu berhasil dimuat! Silakan edit dan simpan ulang.");
      } catch (err: any) {
        alert("Gagal membuka kartu: " + err.message);
      } finally {
        setIsUnlocking(false);
      }
    };
    reader.readAsText(fileToEdit);
  };

  const loadStats = async () => {
    const config = getSupabaseConfig();
    if (!config) {
      alert("Supabase belum terhubung di browser Anda.");
      return;
    }

    setIsLoadingStats(true);
    try {
      const data = await MikirCloud.system.getStats(config);
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleGenerate = async () => {
    if (!owner) {
      alert("Masukkan nama User/Kelas terlebih dahulu.");
      return;
    }
    if (!pin) {
      alert("PIN wajib diisi.");
      return;
    }
    
    // Process Arrays based on Selected Provider
    const geminiArray = selectedProvider === 'gemini' ? geminiKeys.split('\n').map(k => k.trim()).filter(k => k.length > 5) : [];
    const groqArray = selectedProvider === 'groq' ? groqKeys.split('\n').map(k => k.trim()).filter(k => k.length > 5) : [];

    // Validation
    if (selectedProvider === 'gemini' && geminiArray.length === 0) { alert("Gemini Key dipilih tapi kosong!"); return; }
    if (selectedProvider === 'groq' && groqArray.length === 0) { alert("Groq Key dipilih tapi kosong!"); return; }
    if (includeSupabase && (!supabaseUrl || !supabaseKey)) { alert("Supabase config tidak lengkap!"); return; }

    setIsGenerating(true);
    const idToUse = existingId || generateId();

    try {
      // Double check Supabase for duplicate ID if Supabase is enabled
      const sbConfig = getSupabaseConfig();
      if (sbConfig && !existingId) { // Only check if it's a NEW card (no existingId)
        try {
          const exists = await MikirCloud.system.checkKeycardIdExists(sbConfig, idToUse);
          if (exists) {
            alert("ID ini sudah terdaftar di database. Silakan tekan tombol Refresh ID untuk mendapatkan ID baru.");
            setIsGenerating(false);
            return;
          }
        } catch (err) {
          console.warn("Supabase ID check failed, proceeding anyway", err);
        }
      }

      const encryptedString = generateKeycard(pin, {
        id: idToUse, // Use the ID (existing or newly generated)
        metadata: {
          owner,
          created_at: Date.now(),
          expires_at: Date.now() + (expiryDays * 24 * 60 * 60 * 1000),
        },
        config: {
          // Only save keys for the selected provider
          geminiKeys: selectedProvider === 'gemini' && geminiArray.length > 0 ? geminiArray : undefined,
          groqKeys: selectedProvider === 'groq' && groqArray.length > 0 ? groqArray : undefined,
          
          // Legacy fields for backward compatibility
          geminiKey: selectedProvider === 'gemini' && geminiArray.length > 0 ? geminiArray[0] : undefined,
          groqKey: selectedProvider === 'groq' && groqArray.length > 0 ? groqArray[0] : undefined,
          
          preferredProvider: selectedProvider, 
          supabaseUrl: includeSupabase ? supabaseUrl : undefined,
          supabaseKey: includeSupabase ? supabaseKey : undefined
        }
      });

      // Download File - Use application/octet-stream to force .mikir extension
      const blob = new Blob([encryptedString], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Fix filename: ensure .mikir extension and sanitize
      const safeName = owner.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      a.download = `${safeName}.mikir`;
      
      document.body.appendChild(a); 
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert(`Kartu .mikir untuk "${owner}" berhasil disimpan!\nTerdapat ${geminiArray.length} Gemini Keys dan ${groqArray.length} Groq Keys.`);
    } catch (e) {
      alert("Gagal membuat kartu. Cek data kembali.");
    } finally {
      setIsGenerating(false);
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
               <div className="flex space-x-4 mt-1">
                 <button 
                   onClick={() => { setMode('create'); setExistingId(undefined); setOwner(''); setPin('123456'); }} 
                   className={`text-xs font-bold uppercase tracking-wider transition-colors ${mode === 'create' ? 'text-indigo-600 underline decoration-2' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                   Create New
                 </button>
                 <button 
                   onClick={() => setMode('edit')} 
                   className={`text-xs font-bold uppercase tracking-wider transition-colors ${mode === 'edit' ? 'text-indigo-600 underline decoration-2' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                   Edit Existing
                 </button>
                 <button 
                   onClick={() => { setMode('dashboard'); loadStats(); }} 
                   className={`text-xs font-bold uppercase tracking-wider transition-colors ${mode === 'dashboard' ? 'text-indigo-600 underline decoration-2' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                   Cloud Monitor
                 </button>
               </div>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="text-slate-500" /></button>
        </div>

        {/* MODE: DASHBOARD */}
        {mode === 'dashboard' ? (
           <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4 mb-8">
                 <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase mb-1">Total Quizzes</h4>
                    <p className="text-3xl font-black text-indigo-900">{isLoadingStats ? '...' : stats?.quizzes || 0}</p>
                 </div>
                 <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase mb-1">Library Items</h4>
                    <p className="text-3xl font-black text-emerald-900">{isLoadingStats ? '...' : stats?.library || 0}</p>
                 </div>
                 <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
                    <h4 className="text-xs font-bold text-amber-400 uppercase mb-1">Neuro Notes</h4>
                    <p className="text-3xl font-black text-amber-900">{isLoadingStats ? '...' : stats?.notes || 0}</p>
                 </div>
                 <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
                    <h4 className="text-xs font-bold text-rose-400 uppercase mb-1">Active Rooms</h4>
                    <p className="text-3xl font-black text-rose-900">{isLoadingStats ? '...' : stats?.activeRooms || 0}</p>
                 </div>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-slate-700">Database Health</h3>
                    <button onClick={loadStats} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                       <RefreshCw size={16} className={isLoadingStats ? 'animate-spin' : ''} />
                    </button>
                 </div>
                 <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                       <span className="text-slate-500">Status Connection</span>
                       <span className="text-emerald-600 font-bold">Online</span>
                    </div>
                    <div className="flex justify-between text-sm">
                       <span className="text-slate-500">RLS Policies</span>
                       <span className="text-emerald-600 font-bold">Active</span>
                    </div>
                    <div className="flex justify-between text-sm">
                       <span className="text-slate-500">Realtime Engine</span>
                       <span className="text-emerald-600 font-bold">Enabled</span>
                    </div>
                 </div>
              </div>
           </div>
        ) : mode === 'edit' ? (
           <div className="p-10 flex flex-col items-center justify-center h-full space-y-6">
              <div 
                className="w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-indigo-400 transition-all relative"
                onClick={() => document.getElementById('edit-upload')?.click()}
              >
                 <input type="file" id="edit-upload" accept=".mikir" className="hidden" onChange={e => e.target.files && setFileToEdit(e.target.files[0])} />
                 {fileToEdit ? (
                    <div className="flex flex-col items-center text-indigo-600">
                       <FileText size={32} className="mb-2" />
                       <span className="font-bold">{fileToEdit.name}</span>
                    </div>
                 ) : (
                    <div className="flex flex-col items-center text-slate-400">
                       <Upload size={32} className="mb-2" />
                       <span>Click to upload .mikir file</span>
                    </div>
                 )}
              </div>
              
              <div className="w-full max-w-xs">
                 <input 
                   type="password" 
                   value={unlockPin} 
                   onChange={e => setUnlockPin(e.target.value)} 
                   placeholder="Enter Old PIN to Decrypt" 
                   className="w-full text-center border border-slate-300 rounded-xl px-4 py-3 text-slate-800 font-mono focus:ring-2 focus:ring-indigo-500 outline-none" 
                 />
              </div>

              <button 
                onClick={handleLoadCard}
                disabled={!fileToEdit || !unlockPin || isUnlocking}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isUnlocking ? <RefreshCw className="animate-spin mr-2" /> : <ArrowRight className="mr-2" />}
                Load Card Data
              </button>
           </div>
        ) : (
          /* MODE: CREATE / EDIT FORM */
          <>
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

                  <div className="mt-4">
                      <label className="text-slate-600 text-xs font-bold block mb-2 ml-1">Keycard ID (Identity)</label>
                      <div className="flex gap-2">
                          <div className="relative flex-1">
                              <Fingerprint size={16} className="absolute left-3 top-3.5 text-slate-400" />
                              <input 
                                type="text" 
                                readOnly
                                value={existingId || 'ID will be generated on issue...'} 
                                className="w-full bg-slate-100 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-500 font-mono text-xs focus:outline-none cursor-not-allowed" 
                                placeholder="Identity ID"
                              />
                          </div>
                          <button 
                            onClick={() => setExistingId(generateId())}
                            className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors flex items-center justify-center"
                            title="Generate/Refresh ID"
                          >
                            <RefreshCw size={18} className={isGenerating ? 'animate-spin' : ''} />
                          </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 ml-1">ID ini digunakan untuk sinkronisasi data ke Cloud. Jangan diubah jika ingin data tetap sinkron.</p>
                  </div>
              </section>

              <hr className="border-slate-100" />

              {/* Section 2: AI Provider Selection */}
              <section className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="text-amber-500" size={18} />
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Select AI Provider</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <button 
                      onClick={() => setSelectedProvider('gemini')}
                      className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${selectedProvider === 'gemini' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-400 hover:border-indigo-200'}`}
                    >
                      <span className="font-bold">Google Gemini</span>
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded">Recommended</span>
                    </button>
                    <button 
                      onClick={() => setSelectedProvider('groq')}
                      className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${selectedProvider === 'groq' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-400 hover:border-orange-200'}`}
                    >
                      <span className="font-bold">Groq Cloud</span>
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-orange-200 text-orange-700 px-2 py-0.5 rounded">Fastest</span>
                    </button>
                  </div>

                  {/* Gemini Input */}
                  {selectedProvider === 'gemini' && (
                    <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 transition-all">
                      <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-slate-700">Gemini API Keys</span>
                          <div className="flex items-center gap-2">
                              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center bg-indigo-100 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-200 font-bold">
                                Dapatkan Key <ArrowRight size={10} className="ml-1" />
                              </a>
                              <button onClick={() => loadMyKeys('gemini')} className="text-[10px] flex items-center bg-indigo-100 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-200">
                                <Copy size={10} className="mr-1" /> Load Mine
                              </button>
                          </div>
                      </div>
                      <div className="space-y-3">
                        <textarea 
                            value={geminiKeys} 
                            onChange={e => setGeminiKeys(e.target.value)} 
                            placeholder="Paste Gemini Keys here (one per line)..."
                            rows={4}
                            className="w-full text-xs p-2 rounded border border-indigo-200 bg-white font-mono text-indigo-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <details className="group bg-white border border-indigo-100 rounded-lg overflow-hidden">
                           <summary className="p-3 flex items-center cursor-pointer list-none hover:bg-indigo-50/50 transition-colors">
                               <div className="p-1.5 bg-indigo-50 rounded-md mr-3 shrink-0 group-open:bg-indigo-100 transition-colors">
                                  <Zap size={14} className="text-indigo-500" />
                               </div>
                               <div className="flex-1">
                                  <p className="text-xs font-bold text-slate-700">Tutorial: Cara mendapatkan Gemini API Key</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5 group-open:hidden">Klik untuk melihat langkah-langkah</p>
                               </div>
                           </summary>
                           <div className="p-4 pt-0 text-xs text-slate-600 border-t border-indigo-50 bg-indigo-50/30">
                               <ol className="list-decimal ml-4 space-y-2 mt-3">
                                   <li>Buka <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold hover:underline">Google AI Studio</a>.</li>
                                   <li>Login menggunakan akun Google Anda.</li>
                                   <li>Klik tombol <b>"Create API key"</b>.</li>
                                   <li>Pilih <b>"Create API key in new project"</b>.</li>
                                   <li>Tunggu beberapa saat, lalu <b>Copy</b> API Key yang muncul.</li>
                                   <li>Paste API Key tersebut ke dalam kotak di atas.</li>
                               </ol>
                           </div>
                        </details>
                      </div>
                    </div>
                  )}

                  {/* Groq Input */}
                  {selectedProvider === 'groq' && (
                    <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/50 transition-all">
                      <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-slate-700">Groq API Keys</span>
                          <div className="flex items-center gap-2">
                              <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center bg-orange-100 text-orange-600 px-2 py-1 rounded hover:bg-orange-200 font-bold">
                                Dapatkan Key <ArrowRight size={10} className="ml-1" />
                              </a>
                              <button onClick={() => loadMyKeys('groq')} className="text-[10px] flex items-center bg-orange-100 text-orange-600 px-2 py-1 rounded hover:bg-orange-200">
                                <Copy size={10} className="mr-1" /> Load Mine
                              </button>
                          </div>
                      </div>
                      <div className="space-y-3">
                        <textarea 
                            value={groqKeys} 
                            onChange={e => setGroqKeys(e.target.value)} 
                            placeholder="Paste Groq API Keys here (one per line)..."
                            rows={4}
                            className="w-full text-xs p-2 rounded border border-orange-200 bg-white font-mono text-orange-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                        <details className="group bg-white border border-orange-100 rounded-lg overflow-hidden">
                           <summary className="p-3 flex items-center cursor-pointer list-none hover:bg-orange-50/50 transition-colors">
                               <div className="p-1.5 bg-orange-50 rounded-md mr-3 shrink-0 group-open:bg-orange-100 transition-colors">
                                  <Zap size={14} className="text-orange-500" />
                               </div>
                               <div className="flex-1">
                                  <p className="text-xs font-bold text-slate-700">Tutorial: Cara mendapatkan Groq API Key</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5 group-open:hidden">Klik untuk melihat langkah-langkah</p>
                               </div>
                           </summary>
                           <div className="p-4 pt-0 text-xs text-slate-600 border-t border-orange-50 bg-orange-50/30">
                               <ol className="list-decimal ml-4 space-y-2 mt-3">
                                   <li>Buka <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-orange-600 font-bold hover:underline">Groq Cloud Console</a>.</li>
                                   <li>Login menggunakan akun Google atau GitHub Anda.</li>
                                   <li>Klik tombol <b>"Create API Key"</b>.</li>
                                   <li>Masukkan nama untuk API Key Anda (misal: "test").</li>
                                   <li>Klik <b>"Submit"</b>.</li>
                                   <li><b>Copy</b> API Key yang muncul (dimulai dengan <code>gsk_</code>).</li>
                                   <li>Paste API Key tersebut ke dalam kotak di atas.</li>
                               </ol>
                           </div>
                        </details>
                      </div>
                    </div>
                  )}
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
                disabled={isGenerating}
                className="px-8 py-3 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl font-bold flex items-center shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                  {isGenerating ? <RefreshCw className="animate-spin mr-2" size={18} /> : <CreditCard className="mr-2" size={18} />}
                  {existingId ? 'Update Keycard' : 'Issue Keycard'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};
