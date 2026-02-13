
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHandGesture } from '../hooks/useHandGesture';
import { Camera, AlertCircle, Hand } from 'lucide-react';

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
    // Mapping Logic
    if (gesture === 'BACK') {
        onPrev(); // Or Pause/Menu
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

  if (error) return null; // Hide silently on error or show minimal icon

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
       {/* CAMERA FEED & FEEDBACK */}
       <motion.div 
         initial={{ scale: 0.8, opacity: 0 }}
         animate={{ scale: 1, opacity: 1 }}
         className="relative w-48 h-36 bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20"
       >
          <video 
             ref={videoRef} 
             autoPlay 
             playsInline 
             muted 
             className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" // Mirror effect
          />
          <canvas 
             ref={canvasRef} 
             className="absolute inset-0 w-full h-full transform -scale-x-100" 
          />
          
          {/* ROI GUIDE TEXT */}
          <div className="absolute bottom-2 left-0 w-full text-center pointer-events-none">
             {!detectedGesture && (
                <span className="text-[10px] text-white/50 bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">
                   Letakkan Tangan di Kotak
                </span>
             )}
          </div>

          {/* LOADING OVERLAY */}
          {!isLoaded && (
             <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                <Camera className="animate-pulse text-indigo-400" />
             </div>
          )}
       </motion.div>

       {/* STATUS BUBBLE (THE FEEDBACK LOOP) */}
       <AnimatePresence>
          {detectedGesture && (
             <motion.div 
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: -10, opacity: 1 }}
               exit={{ y: 0, opacity: 0 }}
               className="bg-white/90 backdrop-blur-md border border-slate-200 shadow-lg rounded-2xl p-3 flex items-center gap-3 absolute bottom-36 right-0"
             >
                {/* CIRCULAR PROGRESS */}
                <div className="relative w-10 h-10 flex items-center justify-center">
                   <svg className="w-full h-full transform -rotate-90">
                      <circle cx="20" cy="20" r="16" stroke="#e2e8f0" strokeWidth="4" fill="transparent" />
                      <circle 
                        cx="20" cy="20" r="16" 
                        stroke="#4f46e5" strokeWidth="4" fill="transparent"
                        strokeDasharray={100}
                        strokeDashoffset={100 - dwellProgress}
                        strokeLinecap="round"
                        className="transition-all duration-75"
                      />
                   </svg>
                   <span className="absolute text-lg font-bold text-slate-800">
                      {detectedGesture === 'NEXT' ? '👍' : detectedGesture === 'BACK' ? '✋' : detectedGesture}
                   </span>
                </div>
                
                <div className="flex flex-col">
                   <span className="text-[10px] uppercase font-bold text-slate-400">Gesture</span>
                   <span className="text-xs font-bold text-indigo-600">
                      {detectedGesture === 'NEXT' ? 'Lanjut' : 
                       detectedGesture === 'BACK' ? 'Kembali' : 
                       `Pilih ${String.fromCharCode(64 + parseInt(detectedGesture))}`}
                   </span>
                </div>
             </motion.div>
          )}
       </AnimatePresence>
    </div>
  );
};
