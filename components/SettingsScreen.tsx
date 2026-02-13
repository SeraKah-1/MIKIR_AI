
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Save, Trash2, ShieldCheck, Zap, Cpu, Database, HardDrive, Server, Layers, HelpCircle, CheckCircle2, Copy, Palette, LogOut, CreditCard, ShieldAlert, Wrench, Hand } from 'lucide-react';
import { saveApiKey, getApiKey, removeApiKey, saveStorageConfig, getStorageProvider, getSupabaseConfig, saveGestureEnabled, getGestureEnabled } from '../services/storageService';
import { MikirCloud, SUPABASE_SCHEMA_SQL } from '../services/supabaseService'; 
import { setSRSEnabled, isSRSEnabled } from '../services/srsService';
import { requestKaomojiPermission, notifySupabaseSuccess, notifySupabaseError } from '../services/kaomojiNotificationService';
import { getSavedTheme } from '../services/themeService';
import { getKeycardSession, logoutKeycard } from '../services/keycardService'; 
import { GlassButton } from './GlassButton';
import { ThemeSelector } from './ThemeSelector';
import { AiProvider, StorageProvider } from '../types';
import { AdminGenerator } from './AdminGenerator';

const DEFAULT_ADMIN_PASS = "mikir123";

export const SettingsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AiProvider>('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [isGeminiSaved, setIsGeminiSaved] = useState(false);
  const [isGroqSaved, setIsGroqSaved] = useState(false);
  const [storageTab, setStorageTab] = useState<'ai' | 'storage' | 'appearance' | 'features'>('ai');
  const [storageProvider, setStorageProvider] = useState<StorageProvider>('local');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showGuide, setShowGuide] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [srsEnabled, setSrsEnabledState] = useState(true);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(getSavedTheme());
  
  const [sessionMetadata, setSessionMetadata] = useState<any>(null);

  // ADMIN STATES
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [showAdminTool, setShowAdminTool] = useState(false);

  useEffect(() => {
    requestKaomojiPermission();
    const savedGemini = getApiKey('gemini');
    if (savedGemini) { setGeminiKey(savedGemini); setIsGeminiSaved(true); }
    const savedGroq = getApiKey('groq');
    if (savedGroq) { setGroqKey(savedGroq); setIsGroqSaved(true); }
    setStorageProvider(getStorageProvider());
    const sbConfig = getSupabaseConfig();
    if (sbConfig) { setSupabaseUrl(sbConfig.url); setSupabaseKey(sbConfig.key); }
    setSrsEnabledState(isSRSEnabled());
    setGestureEnabled(getGestureEnabled());
    setSessionMetadata(getKeycardSession());
  }, []);

  const handleSaveKeys = () => {
    if (activeTab === 'gemini') {
      if (geminiKey.trim().length > 10) { saveApiKey('gemini', geminiKey.trim()); setIsGeminiSaved(true); alert("Gemini Key berhasil disimpan!"); }
    } else {
      if (groqKey.trim().length > 10) { saveApiKey('groq', groqKey.trim()); setIsGroqSaved(true); alert("Groq Key berhasil disimpan!"); }
    }
  };

  const handleDeleteKey = () => {
    if (confirm(`Hapus API Key?`)) {
      removeApiKey(activeTab);
      if (activeTab === 'gemini') { setGeminiKey(''); setIsGeminiSaved(false); } else { setGroqKey(''); setIsGroqSaved(false); }
    }
  };

  const handleLogout = () => {
     if (confirm("Logout dan cabut akses Keycard?")) {
        logoutKeycard();
        window.location.href = "/";
     }
  };

  const handleTestSupabase = async () => {
    if (!supabaseUrl.startsWith('http') || supabaseKey.length < 10) { alert("Format URL/Key salah."); return; }
    setIsTestingConnection(true); 
    setConnectionStatus('idle');
    
    try {
      const result = await MikirCloud.system.checkConnection({ url: supabaseUrl, key: supabaseKey });
      
      if (result.connected) {
         if (result.schemaMissing) {
            alert("Koneksi OK, tapi Tabel belum ada. Jalankan SQL Schema!"); 
            setConnectionStatus('success'); 
            setShowGuide(true);
         } else {
            setConnectionStatus('success'); 
            notifySupabaseSuccess(); 
         }
      } else {
         throw new Error(result.message);
      }
    } catch (err: any) { 
      setConnectionStatus('error'); 
      notifySupabaseError(); 
      console.error(err);
    } 
    finally { setIsTestingConnection(false); }
  };

  const handleSaveStorage = () => {
    if (storageProvider === 'supabase') {
      if (connectionStatus !== 'success' && !confirm("Tes koneksi belum sukses. Yakin simpan?")) return;
      saveStorageConfig('supabase', { url: supabaseUrl, key: supabaseKey });
      alert("Supabase disimpan!");
    } else {
      saveStorageConfig('local');
      alert("Local Storage aktif.");
    }
  };

  const handleCopySql = () => { navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL); setCopiedSql(true); setTimeout(() => setCopiedSql(false), 2000); };
  const toggleSRS = () => { const newState = !srsEnabled; setSrsEnabledState(newState); setSRSEnabled(newState); };
  const toggleGesture = () => { const newState = !gestureEnabled; setGestureEnabled(newState); saveGestureEnabled(newState); };

  const verifyAdmin = () => {
    const secret = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || DEFAULT_ADMIN_PASS;
    if (adminPassInput === secret) {
       setShowAdminAuth(false);
       setShowAdminTool(true);
       setAdminPassInput('');
    } else {
       alert("Password Admin Salah!");
    }
  };

  if (showAdminTool) {
      return <AdminGenerator onClose={() => setShowAdminTool(false)} />;
  }

  const inputStyle = "w-full bg-theme-glass border border-theme-border rounded-xl px-4 py-3 text-theme-text placeholder:text-theme-muted/50 focus:outline-none focus:ring-2 focus:ring-theme-primary transition-all";
  const tabActive = "bg-theme-primary text-white shadow-lg";
  const tabInactive = "bg-theme-glass text-theme-muted hover:bg-theme-bg border border-transparent hover:border-theme-border";

  return (
    <div className="max-w-2xl mx-auto pt-8 pb-32 px-4 text-theme-text relative">
      
      {/* ADMIN AUTH MODAL */}
      <AnimatePresence>
        {showAdminAuth && (
            <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center"><ShieldAlert className="mr-2 text-rose-500"/> Admin Verification</h3>
                    <input type="password" autoFocus placeholder="Enter Admin PIN" value={adminPassInput} onChange={e => setAdminPassInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && verifyAdmin()} className="w-full border border-slate-300 rounded-xl px-4 py-3 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 bg-white" />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowAdminAuth(false)} className="px-4 py-2 text-slate-500 text-sm">Cancel</button>
                        <button onClick={verifyAdmin} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold">Access</button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Session Info Card */}
      {sessionMetadata && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white mb-8 shadow-lg relative overflow-hidden">
           <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                 <div className="p-3 bg-white/20 rounded-xl"><CreditCard className="text-white" /></div>
                 <div><h3 className="font-bold text-lg">{sessionMetadata.owner}</h3><p className="text-white/60 text-xs">Logged in via Keycard</p></div>
              </div>
              <button onClick={handleLogout} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold flex items-center transition-colors cursor-pointer"><LogOut size={14} className="mr-2" /> Eject Card</button>
           </div>
        </div>
      )}

      <div className="flex space-x-2 md:space-x-4 mb-8 justify-center overflow-x-auto pb-2 scrollbar-hide">
         {['ai', 'storage', 'appearance', 'features'].map(tab => (
           <button key={tab} onClick={() => setStorageTab(tab as any)} className={`px-6 py-2 rounded-full font-medium transition-all whitespace-nowrap capitalize ${storageTab === tab ? tabActive : tabInactive}`}>{tab}</button>
         ))}
      </div>

      <motion.div key={storageTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-theme-glass border border-theme-border rounded-3xl p-8 shadow-xl">
        {storageTab === 'ai' && (
          <>
            <div className="flex items-center space-x-3 mb-6 select-none"><div className="p-3 bg-theme-primary/10 rounded-xl text-theme-primary"><Key size={24} /></div><div><h2 className="text-2xl font-bold">API Key</h2><p className="text-sm opacity-70">Akses Gemini & Groq.</p></div></div>
            {sessionMetadata ? (
               <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 text-sm flex items-center"><ShieldCheck size={18} className="mr-2" /> API Keys dikelola oleh Keycard. Mode Read-Only.</div>
            ) : (
                <>
                <div className="flex bg-theme-glass p-1 rounded-xl mb-6 border border-theme-border">
                <button onClick={() => setActiveTab('gemini')} className={`flex-1 py-2 rounded-lg flex items-center justify-center text-sm font-medium transition-all ${activeTab === 'gemini' ? 'bg-theme-primary text-white shadow-md' : 'text-theme-muted hover:text-theme-text hover:bg-theme-bg/50'}`}><Zap size={16} className="mr-2" /> Gemini</button>
                <button onClick={() => setActiveTab('groq')} className={`flex-1 py-2 rounded-lg flex items-center justify-center text-sm font-medium transition-all ${activeTab === 'groq' ? 'bg-orange-500 text-white shadow-md' : 'text-theme-muted hover:text-orange-500 hover:bg-theme-bg/50'}`}><Cpu size={16} className="mr-2" /> Groq</button>
                </div>
                <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-2 text-theme-text">{activeTab === 'gemini' ? 'Google Gemini Key' : 'Groq API Key'}</label>
                    <input type="password" value={activeTab === 'gemini' ? geminiKey : groqKey} onChange={(e) => activeTab === 'gemini' ? setGeminiKey(e.target.value) : setGroqKey(e.target.value)} placeholder="Paste Key here..." className={inputStyle} />
                </div>
                <div className="flex space-x-3 pt-4 border-t border-theme-border">
                    <GlassButton onClick={handleSaveKeys} className="flex-1 flex items-center justify-center"><Save size={18} className="mr-2" /> Simpan Key</GlassButton>
                    {((activeTab === 'gemini' && isGeminiSaved) || (activeTab === 'groq' && isGroqSaved)) && <button onClick={handleDeleteKey} className="px-4 py-3 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"><Trash2 size={20} /></button>}
                </div>
                </div>
                </>
            )}
          </>
        )}
        
        {storageTab === 'storage' && (
          <>
             <div className="flex items-center space-x-3 mb-6"><div className="p-3 bg-theme-primary/10 rounded-xl text-theme-primary"><Database size={24} /></div><div><h2 className="text-2xl font-bold">Storage</h2><p className="text-sm opacity-70">Pilih penyimpanan data.</p></div></div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button onClick={() => setStorageProvider('local')} className={`p-4 rounded-2xl border text-left transition-all ${storageProvider === 'local' ? 'bg-theme-primary/10 border-theme-primary ring-2 ring-theme-primary/20' : 'bg-theme-glass border-theme-border'}`}>
                <div className="flex items-center space-x-2 text-theme-primary font-bold mb-1"><HardDrive size={18} /> <span>Local</span></div>
                <p className="text-xs opacity-60">Disimpan di Browser.</p>
              </button>
              <button onClick={() => setStorageProvider('supabase')} className={`p-4 rounded-2xl border text-left transition-all ${storageProvider === 'supabase' ? 'bg-emerald-500/10 border-emerald-500/50 ring-2 ring-emerald-500/20' : 'bg-theme-glass border-theme-border'}`}>
                <div className="flex items-center space-x-2 text-emerald-600 font-bold mb-1"><Server size={18} /> <span>Supabase</span></div>
                <p className="text-xs opacity-60">Database Cloud.</p>
              </button>
            </div>
            {storageProvider === 'supabase' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 mb-6">
                <input type="text" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} placeholder="Supabase URL" className={inputStyle} />
                <input type="password" value={supabaseKey} onChange={(e) => setSupabaseKey(e.target.value)} placeholder="Anon Key" className={inputStyle} />
                
                <div className="flex gap-3 pt-2">
                   <button onClick={handleTestSupabase} disabled={isTestingConnection} className={`flex-1 flex items-center justify-center py-3 rounded-xl font-bold text-sm border transition-all ${connectionStatus === 'success' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500' : 'bg-theme-glass border-theme-border text-theme-muted'}`}>{isTestingConnection ? "Checking..." : "Tes Koneksi"}</button>
                   <GlassButton onClick={handleSaveStorage} className="flex-[2] flex items-center justify-center"><Save size={18} className="mr-2" /> Simpan</GlassButton>
                </div>
                <div className="mt-8 border-t border-theme-border pt-6">
                  <button onClick={() => setShowGuide(!showGuide)} className="flex items-center w-full text-sm font-bold text-theme-primary hover:underline"><HelpCircle size={16} className="mr-2" /> {showGuide ? "Tutup Cheat Sheet" : "SQL Cheat Sheet (Nuclear)"}</button>
                  <AnimatePresence>
                     {showGuide && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                           <div className="bg-theme-glass border border-theme-border rounded-xl p-5 mt-4 text-sm opacity-80 space-y-4">
                              <p className="font-bold">SETUP DATABASE (SQL Editor):</p>
                              <div className="relative group">
                                 <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs overflow-x-auto font-mono border border-slate-700">{SUPABASE_SCHEMA_SQL}</pre>
                                 <button onClick={handleCopySql} className="absolute top-2 right-2 p-2 bg-white/10 text-white rounded hover:bg-white/20">{copiedSql ? <CheckCircle2 size={14} /> : <Copy size={14} />}</button>
                              </div>
                           </div>
                        </motion.div>
                     )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </>
        )}

        {storageTab === 'appearance' && (
          <>
             <div className="flex items-center space-x-3 mb-6"><div className="p-3 bg-theme-primary/10 rounded-xl text-theme-primary"><Palette size={24} /></div><div><h2 className="text-2xl font-bold">Tema</h2><p className="text-sm opacity-70">Ganti suasana hati.</p></div></div>
             <ThemeSelector currentTheme={currentTheme} onThemeChange={setCurrentTheme} />
          </>
        )}

        {storageTab === 'features' && (
           <>
             <div className="flex items-center space-x-3 mb-6"><div className="p-3 bg-theme-primary/10 rounded-xl text-theme-primary"><Layers size={24} /></div><div><h2 className="text-2xl font-bold">Fitur</h2></div></div>
             
             <div className="bg-theme-glass border border-theme-border rounded-2xl p-4 flex items-center justify-between mb-4">
               <div><h3 className="font-bold">Spaced Repetition (SRS)</h3><p className="text-xs opacity-60">Review berkala otomatis.</p></div>
               <button onClick={toggleSRS} className={`w-14 h-8 rounded-full p-1 transition-colors ${srsEnabled ? 'bg-theme-primary' : 'bg-slate-300'}`}><motion.div className="w-6 h-6 bg-white rounded-full shadow-sm" animate={{ x: srsEnabled ? 24 : 0 }} /></button>
             </div>

             <div className="bg-theme-glass border border-theme-border rounded-2xl p-4 flex items-center justify-between">
               <div>
                 <h3 className="font-bold flex items-center"><Hand size={14} className="mr-1 text-purple-500" /> Gesture Control</h3>
                 <p className="text-xs opacity-60">Jawab kuis dengan jari (Kamera). <span className="text-rose-500 font-bold text-[10px] uppercase">Experimental</span></p>
               </div>
               <button onClick={toggleGesture} className={`w-14 h-8 rounded-full p-1 transition-colors ${gestureEnabled ? 'bg-purple-500' : 'bg-slate-300'}`}><motion.div className="w-6 h-6 bg-white rounded-full shadow-sm" animate={{ x: gestureEnabled ? 24 : 0 }} /></button>
             </div>
           </>
        )}
      </motion.div>

      <div className="mt-12 text-center">
         <button onClick={() => setShowAdminAuth(true)} className="inline-flex items-center px-4 py-2 rounded-full text-xs font-bold text-theme-muted opacity-40 hover:opacity-100 hover:bg-theme-glass transition-all"><Wrench size={12} className="mr-2" /> Admin Console</button>
      </div>
    </div>
  );
};
