import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogIn, UserPlus, LogOut, Loader2, Shield, Mail, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { MikirCloud } from '../services/supabaseService';
import { getSupabaseConfig } from '../services/storageService';

export const AuthWidget: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const config = getSupabaseConfig();
    if (!config) return;
    try {
      const currentUser = await MikirCloud.auth.getUser(config);
      setUser(currentUser);
    } catch (err) {
      console.error("Auth check failed", err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsLoading(true);

    const config = getSupabaseConfig();
    if (!config) {
      setError("Konfigurasi Supabase belum diatur di tab Storage.");
      setIsLoading(false);
      return;
    }

    try {
      if (mode === 'signup') {
        await MikirCloud.auth.signUp(config, email, password);
        setSuccessMsg("Registrasi berhasil! Silakan cek email untuk verifikasi (jika perlu), atau langsung login.");
        setMode('signin');
      } else {
        await MikirCloud.auth.signIn(config, email, password);
        await checkUser();
        setSuccessMsg("Login berhasil!");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan autentikasi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    const config = getSupabaseConfig();
    if (!config) return;
    setIsLoading(true);
    try {
      await MikirCloud.auth.signOut(config);
      setUser(null);
      setSuccessMsg("Logout berhasil.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (user) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-lg text-theme-text">Akun Saya</h3>
              <p className="text-sm text-theme-muted">{user.email}</p>
            </div>
          </div>
          <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-bold rounded-full border border-emerald-500/20 flex items-center">
            <Shield size={12} className="mr-1" /> Terhubung
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 bg-theme-bg/50 rounded-xl border border-theme-border">
            <p className="text-xs text-theme-muted uppercase font-bold mb-1">User ID</p>
            <p className="text-xs font-mono truncate opacity-70">{user.id}</p>
          </div>
          <div className="p-4 bg-theme-bg/50 rounded-xl border border-theme-border">
            <p className="text-xs text-theme-muted uppercase font-bold mb-1">Last Sign In</p>
            <p className="text-xs font-mono truncate opacity-70">{new Date(user.last_sign_in_at || Date.now()).toLocaleDateString()}</p>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          disabled={isLoading}
          className="w-full py-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl font-bold hover:bg-rose-500/20 transition-all flex items-center justify-center"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <><LogOut size={18} className="mr-2" /> Sign Out</>}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-theme-glass border border-theme-border rounded-2xl p-6 md:p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-theme-primary/10 text-theme-primary mb-4">
          <User size={32} />
        </div>
        <h2 className="text-2xl font-bold text-theme-text">Mikir Cloud Account</h2>
        <p className="text-sm text-theme-muted mt-2">Simpan kuis secara privat & sinkronisasi antar perangkat.</p>
      </div>

      <div className="flex p-1 bg-theme-bg/50 rounded-xl mb-6 border border-theme-border">
        <button 
          onClick={() => setMode('signin')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'signin' ? 'bg-theme-primary text-white shadow' : 'text-theme-muted hover:text-theme-text'}`}
        >
          Sign In
        </button>
        <button 
          onClick={() => setMode('signup')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'signup' ? 'bg-theme-primary text-white shadow' : 'text-theme-muted hover:text-theme-text'}`}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-theme-muted uppercase ml-1">Email</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted" size={18} />
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full bg-theme-bg border border-theme-border rounded-xl pl-12 pr-4 py-3 text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-primary transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-theme-muted uppercase ml-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted" size={18} />
            <input 
              type="password" 
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-theme-bg border border-theme-border rounded-xl pl-12 pr-4 py-3 text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-primary transition-all"
            />
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl flex items-start text-rose-500 text-sm">
              <AlertCircle size={16} className="mr-2 mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
          {successMsg && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-start text-emerald-500 text-sm">
              <CheckCircle2 size={16} className="mr-2 mt-0.5 shrink-0" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          type="submit"
          disabled={isLoading}
          className="w-full py-4 bg-theme-primary text-white rounded-xl font-bold shadow-lg hover:bg-theme-primary/90 active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            mode === 'signin' ? <><LogIn size={20} className="mr-2" /> Masuk ke Akun</> : <><UserPlus size={20} className="mr-2" /> Buat Akun Baru</>
          )}
        </button>
      </form>
      
      {!getSupabaseConfig() && (
        <p className="text-center text-xs text-rose-400 mt-4">
          ⚠️ Supabase belum dikonfigurasi. Pergi ke tab <b>Storage</b> dulu.
        </p>
      )}
    </div>
  );
};
