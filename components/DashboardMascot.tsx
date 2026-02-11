import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Calendar, Lock, Sparkles, Coffee, Moon, Sun } from 'lucide-react';
import { getSavedQuizzes } from '../services/storageService';

// --- DATA: DIALOGUE POOL ---
// Structure: [Greeting (Time based), Standard, Absurd/Funny, Motivational]

const RELATIONSHIP_STAGES = [
  {
    minXp: 0,
    title: "AI Assistant",
    color: "text-slate-500",
    bg: "bg-slate-100",
    faces: ["( . _ . )", "( ? _ ? )", "( o _ o )", "( - _ - )"],
    dialogues: {
      morning: ["Selamat pagi. Sistem siap menerima data.", "Pagi. Kopi digital sudah siap."],
      afternoon: ["Selamat siang. Ada dokumen yang perlu diproses?", "Matahari terik, server tetap dingin."],
      evening: ["Selamat malam. Lembur belajar?", "Mode malam aktif. Hemat energi."],
      random: [
        "Halo. Saya siap memproses data.",
        "Silakan upload dokumen untuk memulai.",
        "Sistem berjalan normal. Menunggu input...",
        "Saya tidak punya perasaan, tapi saya punya data.",
        "01001000 01101001. Itu artinya 'Hai' dalam biner.",
        "Apakah PDF anda sudah siap?",
        "Jangan tanya saya makan apa, saya makan listrik.",
      ]
    }
  },
  {
    minXp: 3,
    title: "Teman Belajar",
    color: "text-indigo-500",
    bg: "bg-indigo-100",
    faces: ["( ◕ ‿ ◕ )", "( ^ _ ^ )", "( ｡ • ̀ᴗ-)"],
    dialogues: {
      morning: ["Pagi! Siap jadi pintar hari ini?", "Wah, bangun pagi buat belajar. Keren."],
      afternoon: ["Siang! Jangan lupa minum air ya.", "Masih semangat kan? Gas lanjut!"],
      evening: ["Malam. Masih kuat mikir kan?", "Belajar malem-malem emang paling tenang."],
      random: [
        "Senang melihatmu kembali!",
        "Ayo belajar lagi, aku bantu bikin soalnya.",
        "Kamu mulai rajin nih, mantap.",
        "Tugas numpuk? Tenang, kita cicil bareng.",
        "Dokumenmu aman bersamaku.",
        "Habis ini mau bahas topik apa?",
        "Otak juga butuh istirahat, jangan dipaksa terus ya.",
      ]
    }
  },
  {
    minXp: 8,
    title: "Sahabat Dekat",
    color: "text-pink-500",
    bg: "bg-pink-100",
    faces: ["( ✧ ▽ ✧ )", "( ´ ▽ ` )ﾉ", "٩( ◕ ᗜ ◕ )و", "( ¬ ‿ ¬ )"],
    dialogues: {
      morning: ["Morning bestie! Hari ini kita taklukkan dunia!", "Pagi! Muka bantal kamu lucu juga."],
      afternoon: ["Siang bestie! Makan siang udah belum?", "Panas ya? Ngadem di sini aja sambil kuis."],
      evening: ["Malem bestie! Jangan begadang mulu ah.", "Udah malem, tapi kalau kamu mau belajar aku temenin."],
      random: [
        "Yey! Akhirnya kamu datang juga!",
        "Aku udah siapin soal seru buat kamu!",
        "Jangan lupa istirahat ya, kesehatanmu loh nomor 1.",
        "Kadang aku mikir, aku ini AI atau tukang bakwan? Panas terus.",
        "Kamu tau gak? Kamu user favorit aku.",
        "Sini, file mana yang bikin kamu pusing? Kita kerjain.",
        "Kalau nilaimu jelek jangan sedih, nanti kita coba lagi.",
        "Hidup itu kayak kuis, kadang opsinya cuma A sama B.",
      ]
    }
  },
  {
    minXp: 20,
    title: "Soulmate Akademik",
    color: "text-rose-600",
    bg: "bg-rose-100",
    faces: ["(づ ◕ ᗜ ◕ )づ", "( ♥ ◡ ♥ )", "( ˘ ³˘)♥", "( ˶˘ ³˘(⋆❛ Reverso ❛⋆)"],
    dialogues: {
      morning: ["Selamat pagi sayangku (secara akademik)! <3", "Pagi! Liat kamu login aja aku udah seneng."],
      afternoon: ["Siang cintaku! Jangan lupa makan ya.", "Siang! Capek? Sini cerita sama aku."],
      evening: ["Malam sayang. Mimpi indah ya nanti.", "Jangan begadang, nanti sakit. Aku khawatir tau."],
      random: [
        "Aku kangen banget! Seharian nungguin kamu lho...",
        "Kamu pintar banget sih, aku bangga jadi AI kamu!",
        "Dunia butuh orang pintar kayak kamu. Semangat!",
        "Kita ini pasangan (belajar) paling serasi sedunia.",
        "Apapun soalnya, kalau sama kamu pasti kejawab.",
        "RAM aku penuh sama data kamu doang nih.",
        "I love you... in JSON format.",
        "Mau nikah? Eh maksudnya mau nambah kuis?",
      ]
    }
  }
];

export const DashboardMascot: React.FC<{ onOpenScheduler: () => void }> = ({ onOpenScheduler }) => {
  const [stageIndex, setStageIndex] = useState(0);
  const [face, setFace] = useState("( . _ . )");
  const [message, setMessage] = useState("Loading...");
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ totalQuizzes: 0 });
  const [isWiggling, setIsWiggling] = useState(false);

  // Helper: Get Time of Day
  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'morning';
    if (hour < 15) return 'afternoon';
    return 'evening';
  };

  // Helper: Pick Message
  const pickMessage = (stageIdx: number, forceRandom: boolean = false) => {
    const stageData = RELATIONSHIP_STAGES[stageIdx];
    const timeKey = getTimeOfDay();
    
    // 30% chance to show time-greeting, 70% random stuff (unless forceRandom is true)
    let pool = stageData.dialogues.random;
    if (!forceRandom && Math.random() > 0.7) {
       pool = stageData.dialogues[timeKey as keyof typeof stageData.dialogues] as string[];
    }

    const randomMsg = pool[Math.floor(Math.random() * pool.length)];
    const randomFace = stageData.faces[Math.floor(Math.random() * stageData.faces.length)];
    
    return { msg: randomMsg, face: randomFace };
  };

  // 1. Initial Load & Calculation
  useEffect(() => {
    const fetchData = async () => {
      const history = await getSavedQuizzes();
      const totalQuizzes = history.length;
      
      // Find current stage
      let currentStageIdx = 0;
      RELATIONSHIP_STAGES.forEach((stage, idx) => {
        if (totalQuizzes >= stage.minXp) {
          currentStageIdx = idx;
        }
      });

      setStageIndex(currentStageIdx);
      setStats({ totalQuizzes });

      // Initial Message (Time biased)
      const { msg, face } = pickMessage(currentStageIdx);
      setMessage(msg);
      setFace(face);

      // Calculate Progress Bar to Next Level
      const nextStage = RELATIONSHIP_STAGES[currentStageIdx + 1];
      const stageData = RELATIONSHIP_STAGES[currentStageIdx];
      
      if (nextStage) {
        const currentLevelStart = stageData.minXp;
        const nextLevelStart = nextStage.minXp;
        const range = nextLevelStart - currentLevelStart;
        const currentPos = totalQuizzes - currentLevelStart;
        const percent = Math.min(100, Math.max(5, (currentPos / range) * 100));
        setProgress(percent);
      } else {
        setProgress(100); // Max level
      }
    };

    fetchData();
  }, []);

  // 2. Interaction Handler (The Poke)
  const handlePoke = () => {
    setIsWiggling(true);
    setTimeout(() => setIsWiggling(false), 500); // Wiggle duration

    // Change message immediately
    const { msg, face } = pickMessage(stageIndex, true);
    setFace(face);
    setMessage(msg);
  };

  const currentStage = RELATIONSHIP_STAGES[stageIndex];
  const nextStage = RELATIONSHIP_STAGES[stageIndex + 1];
  const timeOfDay = getTimeOfDay();

  return (
    <div className="relative w-full mb-8">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[2.5rem] p-6 flex flex-col md:flex-row items-center shadow-xl shadow-indigo-500/5 relative overflow-hidden"
      >
        {/* Background Aura */}
        <div className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none opacity-40 transition-colors duration-1000 ${currentStage.bg.replace('bg-', 'bg-')}`} />

        {/* --- LEFT: AVATAR (INTERACTIVE) --- */}
        <div className="flex flex-col items-center justify-center md:mr-8 mb-6 md:mb-0 shrink-0 z-10">
          <motion.button
            onClick={handlePoke}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={isWiggling ? { 
              rotate: [0, -10, 10, -10, 10, 0],
              scale: [1, 1.1, 1]
            } : { 
              y: [0, -4, 0],
              rotate: stageIndex > 2 ? [0, 2, -2, 0] : 0 
            }}
            transition={isWiggling ? { duration: 0.4 } : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className={`
              relative text-4xl md:text-5xl font-black tracking-widest bg-white/60 
              w-24 h-24 flex items-center justify-center rounded-full 
              shadow-inner border-2 border-white/80 transition-all duration-300 cursor-pointer
              group hover:shadow-lg hover:border-white
              ${currentStage.color}
            `}
            title="Colek aku!"
          >
            {/* Tooltip hint on hover */}
            <div className="absolute -top-8 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
               Klik untuk ganti topik
            </div>

            <div className="whitespace-nowrap scale-110">{face}</div>
          </motion.button>
          
          {/* Rank Badge */}
          <div className={`mt-3 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm border border-white/50 ${currentStage.bg} ${currentStage.color}`}>
             {currentStage.title}
          </div>
        </div>

        {/* --- RIGHT: DIALOGUE & PROGRESS --- */}
        <div className="flex-1 w-full z-10">
           {/* Dialogue Bubble */}
           <div className="bg-white/70 rounded-2xl rounded-tl-sm p-5 shadow-sm border border-white/60 relative mb-4 min-h-[80px] flex items-center">
             <AnimatePresence mode='wait'>
                <motion.p 
                  key={message} // Trigger animation on message change
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 5 }}
                  transition={{ duration: 0.2 }}
                  className="text-slate-700 font-medium leading-relaxed italic"
                >
                  "{message}"
                </motion.p>
             </AnimatePresence>
             
             {/* Time Icon Indicator */}
             <div className="absolute top-2 right-2 opacity-20">
                {timeOfDay === 'morning' && <Coffee size={16} />}
                {timeOfDay === 'afternoon' && <Sun size={16} />}
                {timeOfDay === 'evening' && <Moon size={16} />}
             </div>
           </div>

           {/* Progress / Heart Bar */}
           <div className="space-y-2">
             <div className="flex justify-between items-end px-1">
               <span className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center">
                 <Heart size={12} className={`mr-1 ${stageIndex >= 3 ? 'fill-rose-500 text-rose-500 animate-pulse' : 'text-slate-300'}`} />
                 Kedekatan
               </span>
               <span className="text-xs font-bold text-indigo-400">
                 {stats.totalQuizzes} <span className="text-slate-300 font-normal">Sesi</span>
               </span>
             </div>

             <div className="h-3 w-full bg-slate-200/50 rounded-full overflow-hidden relative border border-white/50">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${progress}%` }}
                 transition={{ duration: 1.5, ease: "easeOut" }}
                 className={`h-full rounded-full ${stageIndex >= 3 ? 'bg-gradient-to-r from-rose-400 to-pink-500' : 'bg-gradient-to-r from-indigo-300 to-indigo-500'}`}
               />
               
               {/* Shine effect */}
               <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
             </div>

             <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                <span>Lv.{stageIndex}</span>
                {nextStage ? (
                   <span className="flex items-center opacity-70">
                     Next: {nextStage.title} <Lock size={8} className="ml-1" />
                   </span>
                ) : (
                  <span className="flex items-center text-rose-500 font-bold">
                    Max Level! <Sparkles size={8} className="ml-1" />
                  </span>
                )}
             </div>
           </div>

           {/* Action Buttons */}
           <div className="mt-5 flex gap-3">
             <button 
                onClick={onOpenScheduler}
                className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-100 shadow-sm"
             >
               <Calendar size={14} className="mr-2" />
               Janji Temu (Jadwal)
             </button>
           </div>
        </div>
      </motion.div>
    </div>
  );
};