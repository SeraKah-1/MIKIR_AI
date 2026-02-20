
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
  const onTriggerRef = useRef(onTrigger);
  
  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  const [state, setState] = useState<GestureState>({
    isLoaded: false,
    error: null,
    detectedGesture: null,
    dwellProgress: 0,
  });
  
  const [isHandDetected, setIsHandDetected] = useState(false);

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
    let loadTimeout: NodeJS.Timeout;
    
    const loadMediaPipe = async () => {
      try {
        // Set a timeout to detect hangs
        loadTimeout = setTimeout(() => {
            if (active) setState(prev => ({ ...prev, error: "Koneksi lambat. Gagal memuat AI." }));
        }, 15000);

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

        clearTimeout(loadTimeout);

        if (active) {
            setState(prev => ({ ...prev, isLoaded: true }));
        }
        
      } catch (err: any) {
        console.error("MediaPipe Load Error:", err);
        clearTimeout(loadTimeout);
        if (active) setState(prev => ({ ...prev, error: "Gagal memuat AI Kamera. Cek koneksi internet." }));
      }
    };

    loadMediaPipe();

    return () => {
      active = false;
      clearTimeout(loadTimeout);
      stopCamera();
      if (landmarkerRef.current) {
          landmarkerRef.current.close();
          landmarkerRef.current = null;
      }
    };
  }, []);

  // --- 2. CAMERA SETUP (Triggered when Loaded) ---
  useEffect(() => {
      if (state.isLoaded && videoRef.current && !videoRef.current.srcObject) {
          startCamera();
      }
  }, [state.isLoaded]);

  const startCamera = async () => {
    if (!videoRef.current) {
        // Retry once if ref is not ready (React render timing)
        setTimeout(() => {
            if (videoRef.current && !videoRef.current.srcObject) startCamera();
        }, 500);
        return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
             width: 320, 
             height: 240,
             facingMode: "user",
             frameRate: { ideal: 30 }
          } 
      });
      
      if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener('loadeddata', predictWebcam);
      }
    } catch (err) {
      console.error("Camera Error:", err);
      setState(prev => ({ ...prev, error: "Akses kamera ditolak. Izinkan akses di browser." }));
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
    
    if (video.currentTime !== lastVideoTimeRef.current) {
        const timeDiff = (video.currentTime - lastVideoTimeRef.current) * 1000;
        if (timeDiff < 100) { // ~10 FPS for smoother feedback
             requestRef.current = requestAnimationFrame(predictWebcam);
             return;
        }
        lastVideoTimeRef.current = video.currentTime;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // --- DRAW ROI BOX (Centered) ---
            const roiW = canvas.width * 0.4; // 40% width
            const roiH = canvas.height * 0.5; // 50% height
            const roiX = (canvas.width - roiW) / 2; // Centered X
            const roiY = (canvas.height - roiH) / 2; // Centered Y

            let startTimeMs = performance.now();
            const results = landmarkerRef.current.detectForVideo(video, startTimeMs);

            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              
              if (results.landmarks && results.landmarks.length > 0) {
                  const landmarks = results.landmarks[0];
                  setIsHandDetected(true);
                  
                  // --- 1. Check ROI ---
                  const wrist = landmarks[0];
                  const inROI = (wrist.x * canvas.width > roiX) && 
                                (wrist.x * canvas.width < roiX + roiW) &&
                                (wrist.y * canvas.height > roiY) &&
                                (wrist.y * canvas.height < roiY + roiH);

                  // Draw Skeleton (Neon Style)
                  drawHand(ctx, landmarks, inROI ? '#00ffcc' : '#f43f5e');

                  if (inROI && !isPaused) {
                    const gesture = recognizeGesture(landmarks);
                    handleDwellTime(gesture);
                  } else {
                    resetDwell();
                  }
              } else {
                  setIsHandDetected(false);
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
         return landmarks[tipIdx].y < landmarks[pipIdx].y; 
      };

      const indexUp = isFingerUp(8, 6);
      const middleUp = isFingerUp(12, 10);
      const ringUp = isFingerUp(16, 14);
      const pinkyUp = isFingerUp(20, 18);

      const fingersUpCount = (indexUp?1:0) + (middleUp?1:0) + (ringUp?1:0) + (pinkyUp?1:0);

      const thumbTip = landmarks[4];
      const thumbIP = landmarks[3];
      const indexMCP = landmarks[5];
      const wrist = landmarks[0];
      const middleMCP = landmarks[9];

      // Calculate Scale (Wrist to Middle MCP)
      const scale = Math.hypot(middleMCP.x - wrist.x, middleMCP.y - wrist.y);

      // Thumb Extension Check (Distance from Index MCP)
      const thumbDist = Math.hypot(thumbTip.x - indexMCP.x, thumbTip.y - indexMCP.y);
      const isThumbExtended = thumbDist > (scale * 0.6); // Threshold relative to hand size

      // Thumb Vertical Check (for Thumbs Up)
      const isThumbUpVertical = thumbTip.y < thumbIP.y;

      // 1. NEXT = Thumbs Up (Strict)
      // Thumb UP, Others DOWN
      if (fingersUpCount === 0 && isThumbUpVertical && isThumbExtended) return "NEXT";

      // 2. BACK = Open Palm (5 Fingers)
      // All 5 fingers UP/Extended
      if (fingersUpCount === 4 && isThumbExtended) return "BACK";

      // 3. Options A, B, C, D
      if (fingersUpCount === 1 && indexUp) return "1"; // A
      if (fingersUpCount === 2 && indexUp && middleUp) return "2"; // B
      if (fingersUpCount === 3 && indexUp && middleUp && ringUp) return "3"; // C
      
      // D = 4 Fingers (Thumb Tucked)
      // 4 Fingers UP, Thumb NOT Extended
      if (fingersUpCount === 4 && !isThumbExtended) return "4"; // D
      
      return null;
  };

  // --- 5. DWELL TIME LOGIC ---
  const handleDwellTime = (gesture: string | null) => {
     const now = performance.now();
     const DWELL_DURATION = 1600; // 1.6s
     
     if (gesture && gesture === lastGestureRef.current) {
        const duration = now - gestureStartTimeRef.current;
        const progress = Math.min(100, (duration / DWELL_DURATION) * 100); 
        
        setState(prev => ({ ...prev, detectedGesture: gesture, dwellProgress: progress }));

        if (duration > DWELL_DURATION && !hasTriggeredRef.current) {
           onTriggerRef.current(gesture);
           hasTriggeredRef.current = true;
           if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([50, 50, 50]); // Burst vibrate
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
      // Neon Glow Effect
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();

      const connections = [
          [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
          [0, 5], [5, 6], [6, 7], [7, 8], // Index
          [0, 9], [9, 10], [10, 11], [11, 12], // Middle
          [0, 13], [13, 14], [14, 15], [15, 16], // Ring
          [0, 17], [17, 18], [18, 19], [19, 20] // Pinky
      ];

      for (const [start, end] of connections) {
          const p1 = landmarks[start];
          const p2 = landmarks[end];
          ctx.moveTo(p1.x * ctx.canvas.width, p1.y * ctx.canvas.height);
          ctx.lineTo(p2.x * ctx.canvas.width, p2.y * ctx.canvas.height);
      }
      ctx.stroke();
      
      // Draw Joints (Nodes)
      ctx.fillStyle = '#ffffff';
      for (const landmark of landmarks) {
          ctx.beginPath();
          ctx.arc(landmark.x * ctx.canvas.width, landmark.y * ctx.canvas.height, 2, 0, 2 * Math.PI);
          ctx.fill();
      }
      
      // Reset Shadow
      ctx.shadowBlur = 0;
  };

  return { videoRef, canvasRef, isHandDetected, ...state };
};
