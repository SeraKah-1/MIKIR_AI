
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHandGesture } from '../hooks/useHandGesture';
import { Camera, Hand } from 'lucide-react';

interface GestureControlProps {
  onOptionSelect: (index: number) => void;
  onNext: () => void;
  onPrev: () => void;
  isAnswered: boolean;
}

export const GestureControl: React.FC<GestureControlProps> = ({ 
  onOptionSelect, onNext, onPrev, isAnswered 
}) => {
  
  const handleTrigger = (gesture: string) => {
    if (gesture === 'BACK') {
        onPrev(); 
    } 
    else if (gesture === 'NEXT' || (isAnswered && ['1','2','3','4'].includes(gesture))) {
        onNext();
    }
    else if (!isAnswered) {
        if (gesture === '1') onOptionSelect(0);
        if (gesture === '2') onOptionSelect(1);
        if (gesture === '3') onOptionSelect(2);
        if (gesture === '4') onOptionSelect(3);
    }
  };

  const { videoRef, canvasRef, isLoaded, error, detectedGesture, dwellProgress } = useHandGesture(handleTrigger, false);

  if (error) return null;

  // Helper to get display text
  const getGestureLabel = (g: string | null) => {
      if (!g) return "";
      if (g === 'NEXT') return "LANJUT";
      if (g === 'BACK') return "KEMBALI";
      if (['1','2','3','4'].includes(g)) {
          const letters = ['A', 'B', 'C', 'D'];
          return letters[parseInt(g) - 1];
      }
      return g;
  };

  const displayLabel = getGestureLabel(detectedGesture);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end pointer-events-none">
       {/* CAMERA FEED (Optimized Size) */}
       <motion.div 
         initial={{ scale: 0.8, opacity: 0 }}
         animate={{ scale: 1, opacity: 1 }}
         className="relative w-32 h-24 md:w-40 md:h-32 bg-black rounded-2xl overflow-hidden shadow-xl border border-white/20 pointer-events-auto"
       >
          <video 
             ref={videoRef} 
             autoPlay 
             playsInline 
             muted 
             className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-80" 
          />
          <canvas 
             ref={canvasRef} 
             className="absolute inset-0 w-full h-full transform -scale-x-100" 
          />
          
          <div className="absolute bottom-0 left-0 w-full text-center bg-black/50 py-0.5">
             {!detectedGesture && (
                <span className="text-[8px] text-white/80 font-bold uppercase tracking-wider">
                   Gesture Active
                </span>
             )}
          </div>

          {!isLoaded && (
             <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                <Camera className="animate-pulse text-indigo-400" size={20} />
             </div>
          )}
       </motion.div>

       {/* FEEDBACK BUBBLE (Restored Clear Visuals) */}
       <AnimatePresence>
          {detectedGesture && (
             <motion.div 
               initial={{ y: 20, opacity: 0, scale: 0.9 }}
               animate={{ y: -10, opacity: 1, scale: 1 }}
               exit={{ y: 0, opacity: 0, scale: 0.9 }}
               className="bg-white/95 backdrop-blur-sm border border-slate-200 shadow-xl rounded-2xl p-4 flex items-center gap-4 absolute bottom-28 md:bottom-36 right-0"
             >
                {/* Progress Ring with Big Text Inside */}
                <div className="relative w-14 h-14 flex items-center justify-center">
                   <svg className="w-full h-full transform -rotate-90">
                      <circle cx="28" cy="28" r="24" stroke="#e2e8f0" strokeWidth="4" fill="transparent" />
                      <circle 
                        cx="28" cy="28" r="24" 
                        stroke="#4f46e5" strokeWidth="4" fill="transparent"
                        strokeDasharray={150}
                        strokeDashoffset={150 - (dwellProgress * 1.5)}
                        strokeLinecap="round"
                        className="transition-all duration-75 ease-linear"
                      />
                   </svg>
                   <span className="absolute text-2xl font-black text-slate-800">
                      {displayLabel}
                   </span>
                </div>
                
                <div className="flex flex-col">
                   <span className="text-[10px] uppercase font-bold text-slate-400 leading-none mb-1">
                      {detectedGesture === 'NEXT' ? 'Navigasi' : 'Pilihan Jawaban'}
                   </span>
                   <span className="text-sm font-bold text-indigo-600 leading-tight whitespace-nowrap">
                      {dwellProgress >= 100 ? "Memproses..." : "Tahan Posisi..."}
                   </span>
                </div>
             </motion.div>
          )}
       </AnimatePresence>
    </div>
  );
};
