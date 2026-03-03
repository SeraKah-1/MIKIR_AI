
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Save, Trash2, ShieldCheck, Zap, Cpu, Database, HardDrive, Server, Layers, HelpCircle, CheckCircle2, Copy, Palette, LogOut, CreditCard, ShieldAlert, Wrench, Hand, ArrowRight, PlayCircle, X, Unlock, User } from 'lucide-react';
import { saveApiKey, getApiKey, removeApiKey, saveStorageConfig, getStorageProvider, getSupabaseConfig, saveGestureEnabled, getGestureEnabled } from '../services/storageService';
import { MikirCloud, SUPABASE_SCHEMA_SQL } from '../services/supabaseService'; 
import { setSRSEnabled, isSRSEnabled } from '../services/srsService';
import { requestKaomojiPermission, notifySupabaseSuccess, notifySupabaseError } from '../services/kaomojiNotificationService';
import { scheduleDailyReminder, getReminderTime } from '../services/notificationService';
import { getSavedTheme } from '../services/themeService';
import { getKeycardSession, logoutKeycard } from '../services/keycardService'; 
import { GlassButton } from './GlassButton';
import { ThemeSelector } from './ThemeSelector';
import { AiProvider, StorageProvider } from '../types';
import { AdminGenerator } from './AdminGenerator';
import { LoginGate } from './LoginGate';
import { AuthWidget } from './AuthWidget';
import { SQLEditor } from './SQLEditor';

const DEFAULT_ADMIN_PASS = "mikir123";

export const SettingsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AiProvider>('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [isGeminiSaved, setIsGeminiSaved] = useState(false);
  const [isGroqSaved, setIsGroqSaved] = useState(false);
  const [storageTab, setStorageTab] = useState<'ai' | 'storage' | 'account' | 'appearance' | 'features' | 'notifications'>('ai');
  const [storageProvider, setStorageProvider] = useState<StorageProvider>('local');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showSQLEditor, setShowSQLEditor] = useState(false);
  const [srsEnabled, setSrsEnabledState] = useState(true);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(getSavedTheme());
  
  const [sessionMetadata, setSessionMetadata] = useState<any>(null);

  // NOTIFICATION STATES
  const [reminderTime, setReminderTime] = useState('');
  const [notifPermission, setNotifPermission] = useState(Notification.permission);

  // ADMIN STATES
  const [showAdminAuth, setShowAdminAuth] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [showAdminTool, setShowAdminTool] = useState(false);
  const [showLoginGate, setShowLoginGate] = useState(false);

  useEffect(() => {
    // Check permissions on mount
    if ("Notification" in window) {
        setNotifPermission(Notification.permission);
    }
    
    const savedTime = getReminderTime();
    if (savedTime) setReminderTime(savedTime);

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

    const handleKeycardChange = () => {
      setSessionMetadata(getKeycardSession());
    };
    window.addEventListener('keycard_changed', handleKeycardChange);
    return () => window.removeEventListener('keycard_changed', handleKeycardChange);
  }, []);

  const handleRequestNotif = async () => {
      const granted = await requestKaomojiPermission();
      setNotifPermission(granted ? 'granted' : 'denied');
      if (granted) alert("Notifikasi diaktifkan! ( ◕ ‿ ◕ )");
      else alert("Notifikasi ditolak browser. Cek setting browser kamu.");
  };

  const handleSaveReminder = () => {
      if (notifPermission !== 'granted') {
          alert("Aktifkan izin notifikasi dulu ya!");
          return;
      }
      if (reminderTime) {
          scheduleDailyReminder(reminderTime);
          alert(`Pengingat diset jam ${reminderTime}!`);
      }
  };

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
            setShowSQLEditor(true);
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
      
      {/* LOGIN GATE MODAL */}
      <AnimatePresence>
        {showLoginGate && (
            <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="relative w-full max-w-md">
                    <button onClick={() => setShowLoginGate(false)} className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white"><X size={24} /></button>
                    <LoginGate onUnlock={() => {
                        setShowLoginGate(false);
                        setSessionMetadata(getKeycardSession());
                    }} />
                </div>
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
         {['ai', 'storage', 'account', 'appearance', 'features', 'notifications'].map(tab => (
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
                    <div className="flex justify-between items-end mb-2">
                       <label className="block text-sm font-medium text-theme-text">{activeTab === 'gemini' ? 'Google Gemini Key' : 'Groq API Key'}</label>
                       <a 
                         href={activeTab === 'gemini' ? 'https://aistudio.google.com/app/apikey' : 'https://console.groq.com/keys'} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="text-xs font-bold text-indigo-500 hover:text-indigo-600 flex items-center bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors"
                       >
                         Dapatkan Key <ArrowRight size={12} className="ml-1" />
                       </a>
                    </div>
                    <input type="password" value={activeTab === 'gemini' ? geminiKey : groqKey} onChange={(e) => activeTab === 'gemini' ? setGeminiKey(e.target.value) : setGroqKey(e.target.value)} placeholder="Paste Key here..." className={inputStyle} />
                    
                    {/* Expandable Tutorial */}
                    <details className="mt-3 group bg-theme-glass border border-theme-border rounded-xl overflow-hidden">
                       <summary className="p-3 flex items-center cursor-pointer list-none hover:bg-theme-bg/50 transition-colors">
                           <div className="p-1.5 bg-theme-primary/10 rounded-md mr-3 shrink-0 group-open:bg-theme-primary/20 transition-colors">
                              <PlayCircle size={16} className="text-theme-primary" />
                           </div>
                           <div className="flex-1">
                              <p className="text-xs font-bold text-theme-text">Tutorial: Cara mendapatkan {activeTab === 'gemini' ? 'Gemini' : 'Groq'} API Key</p>
                              <p className="text-[10px] text-theme-muted mt-0.5 group-open:hidden">Klik untuk melihat langkah-langkah</p>
                           </div>
                       </summary>
                       <div className="p-4 pt-0 text-xs text-theme-muted border-t border-theme-border bg-theme-bg/30">
                           {activeTab === 'gemini' ? (
                               <ol className="list-decimal ml-4 space-y-2 mt-3">
                                   <li>Buka <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-theme-primary font-bold hover:underline">Google AI Studio</a>.</li>
                                   <li>Login menggunakan akun Google Anda.</li>
                                   <li>Klik tombol <b>"Create API key"</b>.</li>
                                   <li>Pilih <b>"Create API key in new project"</b>.</li>
                                   <li>Tunggu beberapa saat, lalu <b>Copy</b> API Key yang muncul.</li>
                                   <li>Paste API Key tersebut ke dalam kotak di atas.</li>
                               </ol>
                           ) : (
                               <ol className="list-decimal ml-4 space-y-2 mt-3">
                                   <li>Buka <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-orange-500 font-bold hover:underline">Groq Cloud Console</a>.</li>
                                   <li>Login menggunakan akun Google atau GitHub Anda.</li>
                                   <li>Klik tombol <b>"Create API Key"</b>.</li>
                                   <li>Masukkan nama untuk API Key Anda (misal: "test").</li>
                                   <li>Klik <b>"Submit"</b>.</li>
                                   <li><b>Copy</b> API Key yang muncul (dimulai dengan <code>gsk_</code>).</li>
                                   <li>Paste API Key tersebut ke dalam kotak di atas.</li>
                               </ol>
                           )}
                       </div>
                    </details>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-theme-text">Database Manager</h3>
                      <p className="text-xs text-theme-muted">Lihat Schema SQL & Data Inspector.</p>
                    </div>
                    <button 
                      onClick={() => setShowSQLEditor(true)} 
                      className="flex items-center px-4 py-2 bg-theme-primary/10 hover:bg-theme-primary/20 text-theme-primary text-xs font-bold rounded-lg transition-all border border-theme-primary/20"
                    >
                      <Database size={16} className="mr-2" /> Open SQL Editor
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}

        {showSQLEditor && <SQLEditor config={{ url: supabaseUrl, key: supabaseKey }} onClose={() => setShowSQLEditor(false)} />}

        {storageTab === 'account' && (
          <AuthWidget />
        )}

        {storageTab === 'appearance' && (
          <>
             <div className="flex items-center space-x-3 mb-6"><div className="p-3 bg-theme-primary/10 rounded-xl text-theme-primary"><Palette size={24} /></div><div><h2 className="text-2xl font-bold">Tema</h2><p className="text-sm opacity-70">Ganti suasana hati.</p></div></div>
             <ThemeSelector currentTheme={currentTheme} onThemeChange={setCurrentTheme} />
          </>
        )}

        {storageTab === 'notifications' && (
            <>
              <div className="flex items-center space-x-3 mb-6"><div className="p-3 bg-theme-primary/10 rounded-xl text-theme-primary"><ShieldAlert size={24} /></div><div><h2 className="text-2xl font-bold">Notifikasi</h2><p className="text-sm opacity-70">Atur pengingat belajar.</p></div></div>
              
              <div className="bg-theme-glass border border-theme-border rounded-2xl p-6 mb-6">
                 <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="font-bold text-lg">Izin Browser</h3>
                        <p className="text-sm opacity-60">Izinkan Mikir mengirim notifikasi.</p>
                    </div>
                    <button 
                        onClick={handleRequestNotif}
                        disabled={notifPermission === 'granted'}
                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${notifPermission === 'granted' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-theme-primary text-white shadow-lg hover:bg-theme-primary/90'}`}
                    >
                        {notifPermission === 'granted' ? 'Aktif (Granted)' : 'Aktifkan Notifikasi'}
                    </button>
                 </div>
                 {notifPermission === 'denied' && (
                     <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs">
                        Browser memblokir notifikasi. Silakan reset izin di pengaturan browser (ikon gembok di URL bar).
                     </div>
                 )}
              </div>

              <div className="bg-theme-glass border border-theme-border rounded-2xl p-6">
                  <h3 className="font-bold text-lg mb-4">Jadwal Belajar Harian</h3>
                  <div className="flex items-end gap-4">
                      <div className="flex-1">
                          <label className="block text-xs font-bold uppercase tracking-wider opacity-60 mb-2">Waktu Pengingat</label>
                          <input 
                            type="time" 
                            value={reminderTime} 
                            onChange={(e) => setReminderTime(e.target.value)}
                            className="w-full bg-theme-bg border border-theme-border rounded-xl px-4 py-3 text-2xl font-mono focus:outline-none focus:ring-2 focus:ring-theme-primary"
                          />
                      </div>
                      <GlassButton onClick={handleSaveReminder} className="h-[58px] px-6 flex items-center justify-center font-bold">
                          <Save size={18} className="mr-2" /> Simpan Jadwal
                      </GlassButton>
                  </div>
                  <p className="text-xs opacity-60 mt-4">
                      * Kami akan mengirim notifikasi lucu setiap hari pada jam ini untuk mengingatkanmu belajar.
                  </p>
              </div>
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

      <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
         <button onClick={() => setShowLoginGate(true)} className="inline-flex items-center px-6 py-3 rounded-xl text-sm font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all"><Unlock size={16} className="mr-2" /> Load Keycard</button>
         <button onClick={() => setShowAdminTool(true)} className="inline-flex items-center px-6 py-3 rounded-xl text-sm font-bold bg-theme-glass border border-theme-border text-theme-muted hover:text-theme-text transition-all"><CreditCard size={16} className="mr-2" /> Create / Edit Keycard</button>
      </div>
    </div>
  );
};
