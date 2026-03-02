import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Play, Copy, CheckCircle2, ArrowLeft, Layers, Loader2, Globe, Lock, Search, User, ShieldCheck } from 'lucide-react';
import { MikirCloud } from '../services/supabaseService';
import { getSupabaseConfig, getSavedQuizzes } from '../services/storageService';
import { Question } from '../types';
import { useGameSound } from '../hooks/useGameSound';

interface MultiplayerLobbyProps {
  onStartGame: (quizData: Question[], isHost: boolean, roomId: string, playerId?: string) => void;
}

type LobbyMode = 'select' | 'host_setup' | 'host_lobby' | 'player_join' | 'player_lobby';

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({ onStartGame }) => {
  const [mode, setMode] = useState<LobbyMode>('select');
  const [history, setHistory] = useState<any[]>([]);
  const [cloudQuizzes, setCloudQuizzes] = useState<any[]>([]);
  const [myCloudQuizzes, setMyCloudQuizzes] = useState<any[]>([]);
  const [quizSource, setQuizSource] = useState<'local' | 'cloud_public' | 'cloud_private'>('local');
  const [selectedQuizId, setSelectedQuizId] = useState<number | string | null>(null);
  const [searchCode, setSearchCode] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Room state
  const [roomCode, setRoomCode] = useState('');
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [players, setPlayers] = useState<any[]>([]);
  const [quizData, setQuizData] = useState<Question[] | null>(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const { playClick, playCorrect } = useGameSound();

  useEffect(() => {
    if (mode === 'host_setup') {
      loadHistory();
      loadCloudQuizzes();
    }
  }, [mode]);

  useEffect(() => {
    if (!roomId) return;

    const config = getSupabaseConfig();
    if (!config) return;

    // Initial load
    refreshPlayers();

    // Subscribe to Players changes
    const playersSubscription = MikirCloud.multiplayer.subscribeToPlayers(config, roomId, (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
        refreshPlayers();
      }
    });

    // Subscribe to Room changes (for Game Start)
    const roomSubscription = MikirCloud.multiplayer.subscribeToRoom(config, roomId, (payload) => {
      if (payload.eventType === 'UPDATE' && payload.new.status === 'playing') {
        // Game Started!
        if (quizData) {
          onStartGame(quizData, false, roomId, playerId);
        } else {
           // If quizData is missing (e.g. player joined late or didn't fetch yet), fetch it now?
           // Ideally players fetch quizData upon joining.
        }
      }
    });

    return () => {
      playersSubscription.unsubscribe();
      roomSubscription.unsubscribe();
    };
  }, [roomId, quizData]);

  const refreshPlayers = async () => {
    if (!roomId) return;
    const config = getSupabaseConfig();
    if (config) {
      const currentPlayers = await MikirCloud.multiplayer.getPlayers(config, roomId);
      setPlayers(currentPlayers);
    }
  };

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const loadHistory = async () => {
    const data = await getSavedQuizzes();
    setHistory(data);
  };

  const loadCloudQuizzes = async () => {
    try {
      const config = getSupabaseConfig();
      if (config) {
        // Check Auth
        const user = await MikirCloud.auth.getUser(config);
        setCurrentUser(user);

        // Fetch Public
        const publicData = await MikirCloud.quiz.list(config, 'public');
        setCloudQuizzes(publicData);

        // Fetch Mine if logged in
        if (user) {
          const myData = await MikirCloud.quiz.list(config, 'mine');
          setMyCloudQuizzes(myData);
        }
      }
    } catch (err) {
      console.error("Failed to load cloud quizzes", err);
    }
  };

  const handleSearchPrivateQuiz = async () => {
    if (!searchCode) return;
    setIsLoading(true);
    try {
      const config = getSupabaseConfig();
      if (!config) throw new Error("Supabase config missing");
      
      const allQuizzes = await MikirCloud.quiz.list(config, 'all');
      const found = allQuizzes.find((q: any) => 
        String(q.id) === searchCode || q.accessCode === searchCode
      );

      if (found) {
        setCloudQuizzes([found]);
        setQuizSource('cloud_public');
        setSelectedQuizId(found.id);
      } else {
        setError("Kuis tidak ditemukan dengan kode/ID tersebut.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!selectedQuizId || !playerName) {
      setError('Pilih kuis dan masukkan nama Anda');
      return;
    }

    let selectedQuiz;
    if (quizSource === 'local') {
      selectedQuiz = history.find(h => h.id === selectedQuizId);
    } else if (quizSource === 'cloud_private') {
      selectedQuiz = myCloudQuizzes.find(c => c.id === selectedQuizId);
    } else {
      selectedQuiz = cloudQuizzes.find(c => c.id === selectedQuizId);
    }

    if (!selectedQuiz || !selectedQuiz.questions) {
      setError('Data kuis tidak valid');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const config = getSupabaseConfig();
      if (!config) throw new Error('Konfigurasi Supabase tidak ditemukan. Silakan atur di Settings.');

      // Test connection first
      const conn = await MikirCloud.system.checkConnection(config);
      if (!conn.connected || conn.schemaMissing) {
        throw new Error(conn.message || 'Gagal terhubung ke database. Pastikan SQL Schema sudah dijalankan.');
      }

      const code = generateRoomCode();
      const hostId = 'host-' + Math.random().toString(36).substr(2, 9);
      
      const room = await MikirCloud.multiplayer.createRoom(config, code, hostId, selectedQuiz.questions);
      
      // Host also joins as a player
      const sessionToken = Math.random().toString(36).substr(2, 9);
      const player = await MikirCloud.multiplayer.joinRoom(config, room.id, playerName, sessionToken);
      
      setRoomCode(code);
      setRoomId(room.id);
      setPlayerId(player.id);
      setQuizData(selectedQuiz.questions);
      setMode('host_lobby');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode || !playerName) {
      setError('Masukkan kode ruangan dan nama Anda');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const config = getSupabaseConfig();
      if (!config) throw new Error('Konfigurasi Supabase tidak ditemukan.');

      // 1. Find Room by Code
      const room = await MikirCloud.multiplayer.findRoom(config, roomCode);
      if (!room) throw new Error('Ruangan tidak ditemukan.');
      if (room.status !== 'waiting') throw new Error('Permainan sudah dimulai atau selesai.');

      // 2. Join Room
      const sessionToken = Math.random().toString(36).substr(2, 9);
      const player = await MikirCloud.multiplayer.joinRoom(config, room.id, playerName, sessionToken);

      setRoomId(room.id);
      setPlayerId(player.id);
      setQuizData(room.quiz_data); // Assuming quiz_data is fetched with room
      setMode('player_lobby');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartGameHost = async () => {
    if (!roomId) return;
    setIsLoading(true);
    try {
      const config = getSupabaseConfig();
      if (config) {
        await MikirCloud.multiplayer.startGame(config, roomId);
        if (quizData) {
           onStartGame(quizData, true, roomId, playerId);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderSelectMode = () => (
    <div className="max-w-4xl mx-auto mt-12 grid md:grid-cols-2 gap-8">
      <div 
        onClick={() => { playClick(); setMode('host_setup'); }}
        className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 hover:border-indigo-200 hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110" />
        <div className="relative z-10">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Users size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Buat Ruangan</h2>
          <p className="text-slate-500 mb-6">Jadi Host dan ajak teman-temanmu bermain kuis bersama secara real-time.</p>
          <span className="inline-flex items-center text-indigo-600 font-bold group-hover:translate-x-2 transition-transform">
            Mulai Setup <ArrowLeft className="ml-2 rotate-180" size={18} />
          </span>
        </div>
      </div>

      <div 
        onClick={() => { playClick(); setMode('player_join'); }}
        className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 hover:border-fuchsia-200 hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-50 rounded-bl-[100px] -mr-8 -mt-8 transition-transform group-hover:scale-110" />
        <div className="relative z-10">
          <div className="w-16 h-16 bg-fuchsia-100 text-fuchsia-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Play size={32} className="ml-1" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Gabung Ruangan</h2>
          <p className="text-slate-500 mb-6">Masukkan kode ruangan untuk bergabung ke permainan yang sudah ada.</p>
          <span className="inline-flex items-center text-fuchsia-600 font-bold group-hover:translate-x-2 transition-transform">
            Masuk Lobby <ArrowLeft className="ml-2 rotate-180" size={18} />
          </span>
        </div>
      </div>
    </div>
  );
  
  const getActiveList = () => {
    if (quizSource === 'local') return history;
    if (quizSource === 'cloud_private') return myCloudQuizzes;
    return cloudQuizzes;
  };

  const renderHostSetup = () => (
    <div className="max-w-2xl mx-auto mt-8">
      <button onClick={() => setMode('select')} className="flex items-center text-slate-500 hover:text-indigo-600 mb-6 font-medium transition-colors">
        <ArrowLeft size={18} className="mr-2" /> Kembali
      </button>
      
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Pilih Kuis untuk Dimainkan</h2>
      
      {/* Source Tabs */}
      <div className="flex p-1 bg-slate-100 rounded-xl mb-6 w-fit overflow-x-auto">
        <button 
          onClick={() => setQuizSource('local')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${quizSource === 'local' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Layers size={16} /> History Lokal
        </button>
        
        {currentUser && (
          <button 
            onClick={() => setQuizSource('cloud_private')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${quizSource === 'cloud_private' ? 'bg-white shadow text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <User size={16} /> Kuis Saya
          </button>
        )}

        <button 
          onClick={() => setQuizSource('cloud_public')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${quizSource === 'cloud_public' ? 'bg-white shadow text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Globe size={16} /> Public Library
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl mb-6 border border-red-100 text-sm">
          {error}
        </div>
      )}

      {quizSource === 'cloud_public' && (
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
              type="text" 
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Cari ID Kuis atau Kode Akses..."
              className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button 
            onClick={handleSearchPrivateQuiz}
            disabled={isLoading}
            className="px-4 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : "Cari"}
          </button>
        </div>
      )}

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 mb-8">
        {getActiveList().length === 0 ? (
          <div className="text-center py-10 text-slate-400 italic">
            {quizSource === 'local' ? "Belum ada history kuis." : "Tidak ada kuis cloud."}
          </div>
        ) : (
          getActiveList().map((quiz, idx) => (
            <div 
              key={`${quiz.id}-${idx}`}
              onClick={() => { playClick(); setSelectedQuizId(quiz.id); }}
              className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${selectedQuizId === quiz.id ? (quizSource === 'local' ? 'bg-indigo-50 border-indigo-500 shadow-md' : quizSource === 'cloud_private' ? 'bg-purple-50 border-purple-500 shadow-md' : 'bg-emerald-50 border-emerald-500 shadow-md') : 'bg-white border-slate-200 hover:border-slate-300'}`}
            >
              <div className="flex items-center gap-4 overflow-hidden">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${selectedQuizId === quiz.id ? (quizSource === 'local' ? 'bg-indigo-200 text-indigo-700' : quizSource === 'cloud_private' ? 'bg-purple-200 text-purple-700' : 'bg-emerald-200 text-emerald-700') : 'bg-slate-100 text-slate-500'}`}>
                  {quiz.questionCount}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-700 truncate">{quiz.fileName}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <span className="uppercase">{quiz.mode}</span>
                    <span>•</span>
                    <span>{new Date(quiz.date || quiz.created_at).toLocaleDateString()}</span>
                    {quiz.visibility === 'private' && <Lock size={10} className="text-slate-400" />}
                  </div>
                </div>
              </div>
              {selectedQuizId === quiz.id && <CheckCircle2 className={quizSource === 'local' ? "text-indigo-500" : quizSource === 'cloud_private' ? "text-purple-500" : "text-emerald-500"} size={24} />}
            </div>
          ))
        )}
      </div>

      <div className="mb-8">
        <label className="block text-sm font-bold text-slate-700 mb-2">Nama Anda (Host)</label>
        <input 
          type="text" 
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Masukkan nama..."
          maxLength={15}
          className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
        />
      </div>

      <button 
        onClick={handleCreateRoom}
        disabled={!selectedQuizId || !playerName || isLoading}
        className={`w-full py-4 text-white rounded-2xl font-bold shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center transition-colors ${quizSource === 'local' ? 'bg-indigo-600 hover:bg-indigo-700' : quizSource === 'cloud_private' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
      >
        {isLoading ? <Loader2 size={20} className="animate-spin mr-2" /> : <Users size={20} className="mr-2" />}
        Buat Ruangan ({quizSource === 'local' ? 'Lokal' : quizSource === 'cloud_private' ? 'Private Cloud' : 'Public Cloud'})
      </button>
    </div>
  );

  const renderHostLobby = () => (
    <div className="max-w-md mx-auto mt-12 text-center">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500" />
        
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Kode Ruangan</h2>
        <div 
          onClick={copyRoomCode}
          className="text-5xl font-black text-slate-800 mb-4 tracking-widest cursor-pointer hover:text-indigo-600 transition-colors flex items-center justify-center gap-4"
        >
          {roomCode}
          {copied ? <CheckCircle2 size={24} className="text-emerald-500" /> : <Copy size={24} className="text-slate-300" />}
        </div>
        <p className="text-slate-500 mb-8 text-sm">Bagikan kode ini ke teman-temanmu untuk bergabung.</p>

        <div className="bg-slate-50 rounded-2xl p-4 mb-8">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center justify-center gap-2">
            <Users size={16} /> Pemain ({players.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {players.length === 0 ? (
              <p className="text-slate-400 text-sm italic">Menunggu pemain...</p>
            ) : (
              players.map((p, i) => (
                <motion.div 
                  key={p.id || i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between bg-white p-3 rounded-xl shadow-sm border border-slate-100"
                >
                  <span className="font-bold text-slate-700">{p.name}</span>
                  {p.is_host && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase">Host</span>}
                </motion.div>
              ))
            )}
          </div>
        </div>

        <button 
          onClick={handleStartGameHost}
          disabled={players.length < 1 || isLoading}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center transition-all"
        >
          {isLoading ? <Loader2 size={20} className="animate-spin mr-2" /> : <Play size={20} className="mr-2" />}
          Mulai Permainan
        </button>
      </div>
    </div>
  );

  const renderPlayerJoin = () => (
    <div className="max-w-md mx-auto mt-12">
      <button onClick={() => setMode('select')} className="flex items-center text-slate-500 hover:text-indigo-600 mb-6 font-medium transition-colors">
        <ArrowLeft size={18} className="mr-2" /> Kembali
      </button>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Gabung Ruangan</h2>
        
        <div className="space-y-4 mb-8">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Kode Ruangan</label>
            <input 
              type="text" 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ABCD"
              maxLength={4}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-black text-center text-2xl tracking-widest uppercase placeholder:text-slate-300"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Nama Anda</label>
            <input 
              type="text" 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Masukkan nama..."
              maxLength={15}
              className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl mb-6 border border-red-100 text-sm text-center">
            {error}
          </div>
        )}

        <button 
          onClick={handleJoinRoom}
          disabled={!roomCode || !playerName || isLoading}
          className="w-full py-4 bg-fuchsia-600 text-white rounded-2xl font-bold shadow-xl hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center transition-all"
        >
          {isLoading ? <Loader2 size={20} className="animate-spin mr-2" /> : <Play size={20} className="mr-2" />}
          Gabung
        </button>
      </div>
    </div>
  );

  const renderPlayerLobby = () => (
    <div className="max-w-md mx-auto mt-12 text-center">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-fuchsia-500" />
        
        <div className="w-20 h-20 bg-fuchsia-50 text-fuchsia-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
          <Loader2 size={40} className="animate-spin" />
        </div>
        
        <h2 className="text-xl font-bold text-slate-800 mb-2">Menunggu Host...</h2>
        <p className="text-slate-500 mb-8">Permainan akan segera dimulai.</p>

        <div className="bg-slate-50 rounded-2xl p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center justify-center gap-2">
            <Users size={16} /> Pemain di Lobby ({players.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {players.map((p, i) => (
              <div 
                key={p.id || i}
                className={`flex items-center justify-between p-3 rounded-xl shadow-sm border ${p.id === playerId ? 'bg-fuchsia-50 border-fuchsia-100' : 'bg-white border-slate-100'}`}
              >
                <span className={`font-bold ${p.id === playerId ? 'text-fuchsia-700' : 'text-slate-700'}`}>
                  {p.name} {p.id === playerId && "(Anda)"}
                </span>
                {p.is_host && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold uppercase">Host</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24">
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {mode === 'select' && renderSelectMode()}
          {mode === 'host_setup' && renderHostSetup()}
          {mode === 'host_lobby' && renderHostLobby()}
          {mode === 'player_join' && renderPlayerJoin()}
          {mode === 'player_lobby' && renderPlayerLobby()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
