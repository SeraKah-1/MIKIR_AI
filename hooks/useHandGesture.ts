
import { useEffect, useRef, useState, useCallback } from 'react';

// --- LOGIC ---
// We use dynamic import for MediaPipe tasks-vision via esm.sh to avoid SyntaxError with 'export'
// and ensure correct module loading.

interface GestureState {
  isLoaded: boolean;
  error: string | null;
  detectedGesture: string | null; // "1", "2", "3", "4", "NEXT", "BACK"
  dwellProgress: number; // 0 - 100
}

export const useHandGesture = (
  onTrigger: (gesture: string) => void,
  isPaused: boolean
) => {
  const [state, setState] = useState<GestureState>({
    isLoaded: false,
    error: null,
    detectedGesture: null,
    dwellProgress: 0,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<any>(null);
  const requestRef = useRef<number>(0);
  const lastGestureRef = useRef<string | null>(null);
  const gestureStartTimeRef = useRef<number>(0);
  const hasTriggeredRef = useRef<boolean>(false);
  const lastVideoTimeRef = useRef<number>(-1);

  // --- 1. LOAD MEDIAPIPE ---
  useEffect(() => {
    let active = true;
    
    const loadMediaPipe = async () => {
      try {
        const { FilesetResolver, HandLandmarker } = await import("https://esm.sh/@mediapipe/tasks-vision@0.10.17");

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm"
        );

        if (!active) return;

        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6
        });

        if (active) {
            setState(prev => ({ ...prev, isLoaded: true }));
            startCamera();
        }
        
      } catch (err: any) {
        console.error("MediaPipe Load Error:", err);
        if (active) setState(prev => ({ ...prev, error: "Gagal memuat AI Kamera." }));
      }
    };

    loadMediaPipe();

    return () => {
      active = false;
      stopCamera();
      if (landmarkerRef.current) {
          landmarkerRef.current.close();
          landmarkerRef.current = null;
      }
    };
  }, []);

  // --- 2. CAMERA SETUP ---
  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
             width: 320, 
             height: 240,
             facingMode: "user",
             frameRate: { ideal: 30 }
          } 
      });
      videoRef.current.srcObject = stream;
      videoRef.current.addEventListener('loadeddata', predictWebcam);
    } catch (err) {
      setState(prev => ({ ...prev, error: "Akses kamera ditolak." }));
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
       const stream = videoRef.current.srcObject as MediaStream;
       stream.getTracks().forEach(track => track.stop());
    }
    cancelAnimationFrame(requestRef.current);
  };

  // --- 3. DETECTION LOOP (THROTTLED) ---
  const predictWebcam = async () => {
    if (!landmarkerRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    
    // THROTTLING: Process only if timestamp changed enough (e.g., every 150ms)
    // currentTime is in seconds.
    if (video.currentTime !== lastVideoTimeRef.current) {
        const timeDiff = (video.currentTime - lastVideoTimeRef.current) * 1000;
        if (timeDiff < 150) { // Limit to ~6-7 FPS for gesture to save battery
             requestRef.current = requestAnimationFrame(predictWebcam);
             return;
        }
        lastVideoTimeRef.current = video.currentTime;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // --- DRAW ROI BOX (Lower Right) ---
            const roiX = canvas.width * 0.25;
            const roiY = canvas.height * 0.3;
            const roiW = canvas.width * 0.5;
            const roiH = canvas.height * 0.7;

            let startTimeMs = performance.now();
            const results = landmarkerRef.current.detectForVideo(video, startTimeMs);

            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              // Visual Feedback for ROI (Subtler)
              ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
              ctx.lineWidth = 1;
              ctx.strokeRect(roiX, roiY, roiW, roiH);
              
              // Check Hands
              if (results.landmarks && results.landmarks.length > 0) {
                  const landmarks = results.landmarks[0];
                  
                  // --- 1. Check ROI ---
                  const wrist = landmarks[0];
                  const inROI = (wrist.x * canvas.width > roiX) && 
                                (wrist.x * canvas.width < roiX + roiW) &&
                                (wrist.y * canvas.height > roiY);

                  // Draw Skeleton (Optimized colors)
                  drawHand(ctx, landmarks, inROI ? '#34d399' : '#f43f5e');

                  if (inROI && !isPaused) {
                    const gesture = recognizeGesture(landmarks);
                    handleDwellTime(gesture);
                  } else {
                    resetDwell();
                  }
              } else {
                  resetDwell();
              }
            }
        }
    }
    
    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  // --- 4. GESTURE RECOGNITION MATH ---
  const recognizeGesture = (landmarks: any[]) => {
      // Finger Tips: 4 (Thumb), 8 (Index), 12 (Middle), 16 (Ring), 20 (Pinky)
      // Finger PIP (Joint 2): 6, 10, 14, 18
      
      const isFingerUp = (tipIdx: number, pipIdx: number) => {
         // Check TIP against PIP (Joint 2) for stability
         return landmarks[tipIdx].y < landmarks[pipIdx].y; 
      };

      const indexUp = isFingerUp(8, 6);
      const middleUp = isFingerUp(12, 10);
      const ringUp = isFingerUp(16, 14);
      const pinkyUp = isFingerUp(20, 18);

      const count = (indexUp?1:0) + (middleUp?1:0) + (ringUp?1:0) + (pinkyUp?1:0);

      const thumbTip = landmarks[4];
      const thumbMCP = landmarks[2];
      const isThumbUp = thumbTip.y < thumbMCP.y; 
      
      if (count === 4 && isThumbUp) return "BACK";
      if (count <= 1 && isThumbUp) return "NEXT";
      if (count === 1 && indexUp) return "1";
      if (count === 2 && indexUp && middleUp) return "2";
      if (count === 3 && indexUp && middleUp && ringUp) return "3";
      if (count === 4 && !isThumbUp) return "4";
      
      return null;
  };

  // --- 5. DWELL TIME LOGIC ---
  const handleDwellTime = (gesture: string | null) => {
     const now = performance.now();
     const DWELL_DURATION = 1600; 
     
     if (gesture && gesture === lastGestureRef.current) {
        const duration = now - gestureStartTimeRef.current;
        const progress = Math.min(100, (duration / DWELL_DURATION) * 100); 
        
        setState(prev => ({ ...prev, detectedGesture: gesture, dwellProgress: progress }));

        if (duration > DWELL_DURATION && !hasTriggeredRef.current) {
           onTrigger(gesture);
           hasTriggeredRef.current = true;
           if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
        }
     } else {
        lastGestureRef.current = gesture;
        gestureStartTimeRef.current = now;
        hasTriggeredRef.current = false;
        setState(prev => ({ 
            ...prev, 
            detectedGesture: gesture, 
            dwellProgress: 0 
        }));
     }
  };

  const resetDwell = () => {
     lastGestureRef.current = null;
     gestureStartTimeRef.current = 0;
     setState(prev => ({ ...prev, detectedGesture: null, dwellProgress: 0 }));
  };

  const drawHand = (ctx: CanvasRenderingContext2D, landmarks: any[], color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      const connections = [
          [0, 1], [1, 2], [2, 3], [3, 4], 
          [0, 5], [5, 6], [6, 7], [7, 8], 
          [0, 9], [9, 10], [10, 11], [11, 12], 
          [0, 13], [13, 14], [14, 15], [15, 16], 
          [0, 17], [17, 18], [18, 19], [19, 20] 
      ];

      for (const [start, end] of connections) {
          const p1 = landmarks[start];
          const p2 = landmarks[end];
          ctx.moveTo(p1.x * ctx.canvas.width, p1.y * ctx.canvas.height);
          ctx.lineTo(p2.x * ctx.canvas.width, p2.y * ctx.canvas.height);
      }
      ctx.stroke();
  };

  return { videoRef, canvasRef, ...state };
};
