import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Key, Save, Trash2, ShieldCheck, ExternalLink, Zap, Cpu, Database, HardDrive, Server } from 'lucide-react';
import { saveApiKey, getApiKey, removeApiKey, saveStorageConfig, getStorageProvider, getSupabaseConfig } from '../services/storageService';
import { GlassButton } from './GlassButton';
import { AiProvider, StorageProvider } from '../types';

export const SettingsScreen: React.FC = () => {
  // AI Keys State
  const [activeTab, setActiveTab] = useState<AiProvider>('gemini');
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [isGeminiSaved, setIsGeminiSaved] = useState(false);
  const [isGroqSaved, setIsGroqSaved] = useState(false);

  // Storage State
  const [storageTab, setStorageTab] = useState<'ai' | 'storage'>('ai');
  const [storageProvider, setStorageProvider] = useState<StorageProvider>('local');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');

  useEffect(() => {
    // Load AI Keys
    const savedGemini = getApiKey('gemini');
    if (savedGemini) {
      setGeminiKey(savedGemini);
      setIsGeminiSaved(true);
    }

    const savedGroq = getApiKey('groq');
    if (savedGroq) {
      setGroqKey(savedGroq);
      setIsGroqSaved(true);
    }

    // Load Storage Settings
    setStorageProvider(getStorageProvider());
    const sbConfig = getSupabaseConfig();
    if (sbConfig) {
      setSupabaseUrl(sbConfig.url);
      setSupabaseKey(sbConfig.key);
    }
  }, []);

  const handleSaveKeys = () => {
    if (activeTab === 'gemini') {
      if (geminiKey.trim().length > 10) {
        saveApiKey('gemini', geminiKey.trim());
        setIsGeminiSaved(true);
        alert("Gemini Key berhasil disimpan!");
      }
    } else {
      if (groqKey.trim().length > 10) {
        saveApiKey('groq', groqKey.trim());
        setIsGroqSaved(true);
        alert("Groq Key berhasil disimpan!");
      }
    }
  };

  const handleDeleteKey = () => {
    if (confirm(`Hapus API Key untuk ${activeTab === 'gemini' ? 'Gemini' : 'Groq'}?`)) {
      removeApiKey(activeTab);
      if (activeTab === 'gemini') {
        setGeminiKey('');
        setIsGeminiSaved(false);
      } else {
        setGroqKey('');
        setIsGroqSaved(false);
      }
    }
  };

  const handleSaveStorage = () => {
    if (storageProvider === 'supabase') {
      if (!supabaseUrl.startsWith('http') || supabaseKey.length < 10) {
        alert("Mohon masukkan URL dan Key Supabase yang valid.");
        return;
      }
      saveStorageConfig('supabase', { url: supabaseUrl, key: supabaseKey });
      alert("Konfigurasi Supabase disimpan! Mode penyimpanan aktif: Database.");
    } else {
      saveStorageConfig('local');
      alert("Mode penyimpanan aktif: Local Storage (Browser).");
    }
  };

  return (
    <div className="max-w-2xl mx-auto pt-8 pb-24 px-4">
      {/* Top Tabs */}
      <div className="flex space-x-4 mb-8 justify-center">
         <button 
           onClick={() => setStorageTab('ai')}
           className={`px-6 py-2 rounded-full font-medium transition-all ${storageTab === 'ai' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-white/40 text-slate-500 hover:bg-white/60'}`}
         >
           AI Keys
         </button>
         <button 
           onClick={() => setStorageTab('storage')}
           className={`px-6 py-2 rounded-full font-medium transition-all ${storageTab === 'storage' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-white/40 text-slate-500 hover:bg-white/60'}`}
         >
           Storage
         </button>
      </div>

      <motion.div
        key={storageTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl"
      >
        {storageTab === 'ai' ? (
          <>
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
                <Key size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Konfigurasi API</h2>
                <p className="text-slate-500 text-sm">Kelola akses Gemini & Groq.</p>
              </div>
            </div>

            {/* Provider Tabs */}
            <div className="flex bg-white/50 p-1 rounded-xl mb-6 border border-white/60">
              <button 
                onClick={() => setActiveTab('gemini')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center text-sm font-medium transition-all ${activeTab === 'gemini' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-indigo-500'}`}
              >
                <Zap size={16} className="mr-2" /> Google Gemini
              </button>
              <button 
                onClick={() => setActiveTab('groq')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center text-sm font-medium transition-all ${activeTab === 'groq' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-orange-500'}`}
              >
                <Cpu size={16} className="mr-2" /> Groq Cloud
              </button>
            </div>

            <div className="space-y-6">
              {activeTab === 'gemini' ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Google Gemini API Key</label>
                  <input 
                    type="password" 
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  />
                  <p className="text-xs text-slate-500 mt-2 flex items-center">
                    Gratis & Cepat. <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline ml-1 flex items-center">Dapatkan Key <ExternalLink size={10} className="ml-1" /></a>
                  </p>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Groq Cloud API Key</label>
                  <input 
                    type="password" 
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder="gsk_..."
                    className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                  />
                  <p className="text-xs text-slate-500 mt-2 flex items-center">
                    Ultra Fast Inference. <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-orange-600 hover:underline ml-1 flex items-center">Dapatkan Key <ExternalLink size={10} className="ml-1" /></a>
                  </p>
                </motion.div>
              )}

              <div className="flex space-x-3 pt-4 border-t border-slate-200/50">
                <GlassButton onClick={handleSaveKeys} className="flex-1 flex items-center justify-center">
                  <Save size={18} className="mr-2" />
                  Simpan Key
                </GlassButton>
                
                {((activeTab === 'gemini' && isGeminiSaved) || (activeTab === 'groq' && isGroqSaved)) && (
                  <button 
                    onClick={handleDeleteKey}
                    className="px-4 py-3 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors"
                    title="Hapus Key"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
             <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
                <Database size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Storage Engine</h2>
                <p className="text-slate-500 text-sm">Pilih tempat menyimpan data quiz.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <button 
                onClick={() => setStorageProvider('local')}
                className={`p-4 rounded-2xl border text-left transition-all ${storageProvider === 'local' ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/20' : 'bg-white/30 border-slate-200'}`}
              >
                <div className="flex items-center space-x-2 text-indigo-700 font-bold mb-1">
                  <HardDrive size={18} /> <span>Local</span>
                </div>
                <p className="text-xs text-slate-500">Disimpan di Browser. Cepat, Private, tapi hilang jika cache dihapus.</p>
              </button>
              
              <button 
                onClick={() => setStorageProvider('supabase')}
                className={`p-4 rounded-2xl border text-left transition-all ${storageProvider === 'supabase' ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/20' : 'bg-white/30 border-slate-200'}`}
              >
                <div className="flex items-center space-x-2 text-emerald-700 font-bold mb-1">
                  <Server size={18} /> <span>Supabase</span>
                </div>
                <p className="text-xs text-slate-500">Database Cloud. Data aman, bisa diakses antar device (jika ada Auth).</p>
              </button>
            </div>

            {storageProvider === 'supabase' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 mb-6">
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Supabase URL</label>
                   <input 
                    type="text" 
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://xyz.supabase.co"
                    className="w-full mt-1 bg-white/60 border border-slate-200 rounded-xl px-4 py-2 text-sm"
                   />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 uppercase">Supabase Anon Key</label>
                   <input 
                    type="password" 
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    placeholder="eyJhb..."
                    className="w-full mt-1 bg-white/60 border border-slate-200 rounded-xl px-4 py-2 text-sm"
                   />
                </div>
                 <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-xs flex items-start">
                   <ShieldCheck size={14} className="mr-2 shrink-0 mt-0.5" />
                   Pastikan Anda sudah menjalankan SQL Schema di Dashboard Supabase Anda agar tabel 'generated_quizzes' tersedia.
                 </div>
              </motion.div>
            )}

            <GlassButton onClick={handleSaveStorage} fullWidth>
              <Save size={18} className="mr-2" /> Simpan Konfigurasi Storage
            </GlassButton>
          </>
        )}
      </motion.div>
    </div>
  );
};