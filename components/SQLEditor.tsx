
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Play, Database, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { MikirCloud, SUPABASE_SCHEMA_SQL } from '../services/supabaseService';

interface SQLEditorProps {
  onClose: () => void;
  config: { url: string; key: string };
}

export const SQLEditor: React.FC<SQLEditorProps> = ({ onClose, config }) => {
  const [sql, setSql] = useState(SUPABASE_SCHEMA_SQL);
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleRunSQL = async () => {
    setIsExecuting(true);
    setResult(null);
    try {
      const res = await MikirCloud.system.runSQL(config, sql);
      if (res.success) {
        setResult({ success: true, message: "Schema SQL berhasil dijalankan! Tabel telah dibuat." });
      } else {
        setResult({ success: false, message: res.message || "Gagal menjalankan SQL." });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message || "Terjadi kesalahan sistem." });
    } finally {
      setIsExecuting(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sql);
    alert("SQL copied to clipboard!");
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="bg-theme-bg border border-theme-border w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-theme-border flex items-center justify-between bg-theme-glass">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-theme-primary/10 rounded-lg text-theme-primary">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-theme-text">SQL Editor</h2>
              <p className="text-xs text-theme-muted">Inisialisasi Database Supabase</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-theme-bg rounded-full transition-colors text-theme-muted hover:text-theme-text"
          >
            <X size={24} />
          </button>
        </div>

        {/* Editor Area */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-theme-text">SQL Script</label>
            <button 
              onClick={copyToClipboard}
              className="text-xs flex items-center text-theme-primary hover:underline"
            >
              <Copy size={14} className="mr-1" /> Copy SQL
            </button>
          </div>
          
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            className="flex-1 w-full bg-slate-950 text-emerald-400 font-mono text-sm p-4 rounded-xl border border-theme-border focus:outline-none focus:ring-2 focus:ring-theme-primary resize-none"
            spellCheck={false}
          />

          {result && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl flex items-start space-x-3 ${result.success ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600' : 'bg-rose-500/10 border border-rose-500/30 text-rose-500'}`}
            >
              {result.success ? <CheckCircle2 size={20} className="shrink-0" /> : <AlertCircle size={20} className="shrink-0" />}
              <p className="text-sm font-medium">{result.message}</p>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-theme-border bg-theme-glass flex items-center justify-between">
          <p className="text-xs text-theme-muted max-w-md">
            Pastikan Anda telah mengaktifkan ekstensi <b>pgvector</b> di dashboard Supabase jika menggunakan fitur pencarian vektor.
          </p>
          <button
            onClick={handleRunSQL}
            disabled={isExecuting}
            className="px-8 py-3 bg-theme-primary text-white rounded-xl font-bold flex items-center shadow-lg shadow-theme-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
          >
            {isExecuting ? (
              <>Executing...</>
            ) : (
              <>
                <Play size={18} className="mr-2" /> Run SQL
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};
