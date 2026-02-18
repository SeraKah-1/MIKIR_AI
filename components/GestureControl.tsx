
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
    // Mapping Logic - Strictly Input only. Sound is handled by QuizInterface.
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

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end pointer-events-none">
       {/* CAMERA FEED */}
       <motion.div 
         initial={{ scale: 0.8, opacity: 0 }}
         animate={{ scale: 1, opacity: 1 }}
         className="relative w-40 h-32 bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 pointer-events-auto"
       >
          <video 
             ref={videoRef} 
             autoPlay 
             playsInline 
             muted 
             className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" 
          />
          <canvas 
             ref={canvasRef} 
             className="absolute inset-0 w-full h-full transform -scale-x-100" 
          />
          
          <div className="absolute bottom-1 left-0 w-full text-center">
             {!detectedGesture && (
                <span className="text-[9px] text-white/70 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                   Gesture Ready
                </span>
             )}
          </div>

          {!isLoaded && (
             <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
                <Camera className="animate-pulse text-indigo-400" size={24} />
             </div>
          )}
       </motion.div>

       {/* FEEDBACK BUBBLE */}
       <AnimatePresence>
          {detectedGesture && (
             <motion.div 
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: -10, opacity: 1 }}
               exit={{ y: 0, opacity: 0 }}
               className="bg-white/90 backdrop-blur-md border border-slate-200 shadow-lg rounded-2xl p-2 flex items-center gap-3 absolute bottom-32 right-0 pr-4"
             >
                <div className="relative w-8 h-8 flex items-center justify-center">
                   <svg className="w-full h-full transform -rotate-90">
                      <circle cx="16" cy="16" r="14" stroke="#e2e8f0" strokeWidth="3" fill="transparent" />
                      <circle 
                        cx="16" cy="16" r="14" 
                        stroke="#4f46e5" strokeWidth="3" fill="transparent"
                        strokeDasharray={88}
                        strokeDashoffset={88 - (dwellProgress * 0.88)}
                        strokeLinecap="round"
                        className="transition-all duration-75"
                      />
                   </svg>
                   <span className="absolute text-xs font-bold text-slate-800">
                      {detectedGesture === 'NEXT' ? '👍' : detectedGesture === 'BACK' ? '✋' : detectedGesture}
                   </span>
                </div>
                
                <div className="flex flex-col">
                   <span className="text-[10px] uppercase font-bold text-slate-400 leading-none">Detecting</span>
                   <span className="text-xs font-bold text-indigo-600">
                      {detectedGesture === 'NEXT' ? 'Lanjut' : 
                       detectedGesture === 'BACK' ? 'Kembali' : 
                       `Pilih ${['A','B','C','D'][parseInt(detectedGesture)-1]}`}
                   </span>
                </div>
             </motion.div>
          )}
       </AnimatePresence>
    </div>
  );
};
