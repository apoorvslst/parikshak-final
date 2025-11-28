import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { Eye, EyeOff, Activity, History, UserCheck, ShieldAlert, Smile, Meh, Move, Bug } from 'lucide-react';
import { useFirebase } from "../context/Firebase";
import { useNavigate } from "react-router-dom";

const Live = () => {
  // Firebase & Router
  const { isUserLoggedIn, currentUser, loginWithGoogle } = useFirebase();
  const navigate = useNavigate();

  // --- GEMINI API CONFIGURATION ---
  const apiKey = "AIzaSyBrXjp8Z4goO-BaJxvyehzhBShHyez9Lbw";

  // --- State Management ---
  const [score, setScore] = useState(100);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  // Real-time Metrics
  const [gazeStatus, setGazeStatus] = useState("Initializing...");
  const [isAngry, setIsAngry] = useState(false); // Used for visual alert

  // --- Movement Metrics ---
  const [movementIntensity, setMovementIntensity] = useState(0);
  const [movementLabel, setMovementLabel] = useState("Detecting...");
  const [staticTimer, setStaticTimer] = useState(0);

  // Debug Metrics for Calibration
  const [debugMetrics, setDebugMetrics] = useState({ pitchRatio: 0, eyeScore: 0 });

  // Emotion Analysis State (Simplified)
  const [currentEmotion, setCurrentEmotion] = useState({ label: 'Neutral', confidence: 0 });

  // Logs
  const [logs, setLogs] = useState([]);

  // --- AI FEATURES STATE ---
  const [quickTip, setQuickTip] = useState(null);
  const [isTipLoading, setIsTipLoading] = useState(false);

  // --- Refs ---
  const videoRef = useRef(null);
  const landmarkerRef = useRef(null);
  const requestRef = useRef(null);
  const streamRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);

  // --- Logic Refs (Timers) ---
  const lastNosePosRef = useRef({ x: 0.5, y: 0.5 });
  const timersRef = useRef({
    staticStart: Date.now(),
    readingStart: null,
    focusStart: null,
    neutralStart: null,
    happyStart: null,
    angryStart: null
  });

  // --- Constants (PERFECT SCORING PATTERN) ---
  const MOVEMENT_THRESHOLD = 0.005;
  const STATIC_LIMIT_MS = 60000; // Static limit: 60 seconds

  // --- Helper: Add to Log ---
  const addLog = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [{ time, message, type }, ...prev].slice(0, 10));
  };

  // --- Helper: Stop Webcam ---
  const stopWebcam = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    addLog("Webcam stopped.", "info");
  }, []);

  // 1. Initialize MediaPipe
  useEffect(() => {
    const loadModel = async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );

        landmarkerRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });

        setIsModelLoaded(true);
        addLog("Vision Model loaded.", "success");
      } catch (error) {
        console.error("Error loading MediaPipe:", error);
        addLog("Failed to load Vision Model", "error");
      }
    };
    loadModel();
    return () => stopWebcam();
  }, [stopWebcam]);

  // 4. The Prediction Loop
  const predictWebcam = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    const now = Date.now();

    if (video && landmarker) {
      let startTimeMs = performance.now();

      if (video.currentTime !== lastVideoTimeRef.current && video.readyState >= 2) {
        lastVideoTimeRef.current = video.currentTime;

        const result = landmarker.detectForVideo(video, startTimeMs);

        if (result.faceBlendshapes && result.faceBlendshapes.length > 0 && result.faceLandmarks && result.faceLandmarks.length > 0) {
          const shapes = result.faceBlendshapes[0].categories;
          const landmarks = result.faceLandmarks[0];

          const getShape = (name) => shapes.find(s => s.categoryName === name)?.score || 0;

          // ----------------------------------------------------------------
          // 1. EMOTION DETECTION
          // ----------------------------------------------------------------
          const happyScore = (getShape('mouthSmileLeft') + getShape('mouthSmileRight')) / 2;
          const angryScore = (getShape('browDownLeft') + getShape('browDownRight') + getShape('jawForward')) / 3;
          const neutralThreshold = 0.3;

          let emotionLabel = 'Neutral';
          let maxScore = 0;

          if (happyScore > neutralThreshold && happyScore > angryScore) {
            emotionLabel = 'Happy';
            maxScore = happyScore;
          } else if (angryScore > neutralThreshold && angryScore > happyScore) {
            emotionLabel = 'Angry';
            maxScore = angryScore;
          }

          setCurrentEmotion({ label: emotionLabel, confidence: maxScore });
          setIsAngry(emotionLabel === 'Angry' && angryScore > 0.6);

          // --- SCORING: EMOTIONS ---

          // Happy: +1 every 60s
          if (emotionLabel === 'Happy') {
            if (!timersRef.current.happyStart) timersRef.current.happyStart = now;
            else if (now - timersRef.current.happyStart > 60000) {
              setScore(s => Math.min(100, s + 1));
              addLog("Reward (+1): Happy for 1 min", "success");
              timersRef.current.happyStart = now;
            }
          } else {
            timersRef.current.happyStart = null;
          }

          // Neutral: -1 every 3 mins (180s)
          if (emotionLabel === 'Neutral') {
            if (!timersRef.current.neutralStart) timersRef.current.neutralStart = now;
            else if (now - timersRef.current.neutralStart > 180000) {
              setScore(s => Math.max(0, s - 1));
              addLog("Penalty (-1): Neutral for 3 mins", "warning");
              timersRef.current.neutralStart = now;
            }
          } else {
            timersRef.current.neutralStart = null;
          }

          // Angry: -5 every 10s
          if (emotionLabel === 'Angry') {
            if (!timersRef.current.angryStart) timersRef.current.angryStart = now;
            else if (now - timersRef.current.angryStart > 10000) {
              setScore(s => Math.max(0, s - 5));
              addLog("Penalty (-5): Anger detected (10s)", "error");
              timersRef.current.angryStart = now;
            }
          } else {
            timersRef.current.angryStart = null;
          }

          // ----------------------------------------------------------------
          // 2. GAZE / READING DETECTION
          // ----------------------------------------------------------------
          const nose = landmarks[1];
          const chin = landmarks[152];
          const forehead = landmarks[10];
          const noseToChin = Math.abs(chin.y - nose.y);
          const noseToForehead = Math.abs(nose.y - forehead.y);

          const headPitchRatio = noseToChin / (noseToForehead || 1);
          const eyeLookDown = (getShape('eyeLookDownLeft') + getShape('eyeLookDownRight')) / 2;

          let isReading = false;
          if (headPitchRatio < 1.2 || eyeLookDown > 0.6) {
            setGazeStatus("Reading / Looking Down");
            isReading = true;
          } else {
            setGazeStatus("Focused on Class");
            isReading = false;
          }
          setDebugMetrics({ pitchRatio: headPitchRatio, eyeScore: eyeLookDown });

          // --- SCORING: GAZE ---

          if (isReading) {
            timersRef.current.focusStart = null;
            if (!timersRef.current.readingStart) timersRef.current.readingStart = now;
            else if (now - timersRef.current.readingStart > 30000) { // Penalty every 30s
              setScore(s => Math.max(0, s - 2));
              addLog("Penalty (-2): Reading for 30s", "warning");
              timersRef.current.readingStart = now;
            }
          } else {
            timersRef.current.readingStart = null;
            if (!timersRef.current.focusStart) timersRef.current.focusStart = now;
            else if (now - timersRef.current.focusStart > 60000) { // Reward every 60s
              setScore(s => Math.min(100, s + 1));
              addLog("Reward (+1): Focused for 1 min", "success");
              timersRef.current.focusStart = now;
            }
          }

          // ----------------------------------------------------------------
          // 3. MOVEMENT DETECTION
          // ----------------------------------------------------------------
          const prevNose = lastNosePosRef.current;
          const dist = Math.sqrt(Math.pow(nose.x - prevNose.x, 2) + Math.pow(nose.y - prevNose.y, 2));

          const normalizedMovement = Math.min(100, (dist * 5000));
          setMovementIntensity(prev => (prev * 0.9) + (normalizedMovement * 0.1));

          if (dist > MOVEMENT_THRESHOLD) {
            setMovementLabel("Dynamic / Active");
            timersRef.current.staticStart = now;
            setStaticTimer(0);
          } else {
            setMovementLabel("Stationary");
            const staticElapsed = now - timersRef.current.staticStart;
            setStaticTimer(staticElapsed / 1000);

            // Static Penalty: -3 every 60s
            if (staticElapsed > STATIC_LIMIT_MS) {
              // trigger once per second multiple check is avoided; use floored seconds check
              if (Math.floor(staticElapsed / 1000) % 60 === 0 && Math.floor(staticElapsed) !== Math.floor(staticElapsed - 100)) {
                setScore(prev => Math.max(0, prev - 3));
                addLog("Penalty (-3): Static for 1 min", "warning");
              }
            }
          }
          lastNosePosRef.current = { x: nose.x, y: nose.y };

        }
      }
    }
    requestRef.current = requestAnimationFrame(predictWebcam);
  }, []);

  // 2. Start Webcam
  const startWebcam = async () => {
    stopWebcam();
    try {
      const constraints = {
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const videoReady = new Promise(resolve => {
          videoRef.current.onloadeddata = () => resolve();
        });
        await videoReady;
        setCameraActive(true);
        // Reset all timers on start
        const now = Date.now();
        timersRef.current = {
          staticStart: now,
          readingStart: null,
          focusStart: now,
          neutralStart: null,
          happyStart: null,
          angryStart: null
        };
        predictWebcam();
        addLog("Monitoring started.", "success");
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      addLog("Error accessing webcam.", "error");
    }
  };

  // --- AI FEATURES (Quick Tip Only) ---
  const getQuickTip = async () => {
    setIsTipLoading(true);
    setQuickTip(null);
    try {
      const prompt = `
        I am a teacher. Current state: ${currentEmotion.label}, ${movementLabel}, ${gazeStatus}.
        Give me one short sentence (max 20 words) on how to improve right now to avoid time-based score penalties.
      `;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );
      const data = await response.json();
      if (data.candidates && data.candidates[0].content) {
        setQuickTip(data.candidates[0].content.parts[0].text.trim().replace(/^['"]|['"]$/g, ''));
      }
    } catch (error) {
      console.error("Gemini API Error:", error);
    } finally {
      setIsTipLoading(false);
    }
  };

  const getEmotionIcon = (label) => {
    switch (label) {
      case 'Happy': return <Smile className="w-8 h-8 text-green-500" />;
      case 'Angry': return <ShieldAlert className="w-8 h-8 text-red-500" />;
      default: return <Meh className="w-8 h-8 text-zinc-500" />;
    }
  };

  // --- UI Components ---
  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans">
      <nav className="fixed top-0 left-0 w-full flex flex-row bg-transparent justify-between text-white">
          <div className="left flex flex-row">
            <img
              className="w-20 h-20 ms-20"
              src="https://cdn.creazilla.com/icons/3432265/teacher-icon-lg.png"
              alt=""
            />
            <div className="name mt-7 mx-5 text-lg font-medium">
              Parikshak AI
            </div>
          </div>

          <div className="right flex flex-row justify-around items-center">
            <span onClick={()=>navigate('/')} className="mx-10 cursor-pointer">Home</span>
            <span onClick={()=>navigate("/insights")} className="mx-10 cursor-pointer">Insights</span>
            <span onClick={()=>navigate('/textanalysis')} className="mx-10 cursor-pointer">Upload & Analyse</span>
            <span className="mx-10 cursor-pointer">Live Monitor</span>
            <span onClick={() => navigate("/feedback")} className="mx-10 cursor-pointer">Feedback</span>
            {isUserLoggedIn ? (
  <img
    src={currentUser.photoURL || "/fallback-avatar.png"}
    alt="https://media.istockphoto.com/id/1553217327/vector/user-profile-icon-avatar-person-sign-profile-picture-portrait-symbol-easily-editable-line.jpg?s=170667a&w=0&k=20&c=xUuHLFaa94WIFdV-XBgxX9SSsaJJgGQhE1Tmevqrytg="
    className="mx-10 w-10 h-10 rounded-full border border-white"
  />
) : (
  <button className="mx-10 bg-[#24cfa6] h-9 w-28 rounded" onClick={()=>navigate("/login")}>
    Sign In
  </button>
)}
          </div>
        </nav>
        <div className="max-w-6xl mx-auto flex justify-between items-center pt-30">
          <div className="flex items-center gap-3">
            <div className="bg-[#24cfa6] p-2 rounded-lg">
              <UserCheck className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Live Monitor</h1>
              <p className="text-sm text-zinc-400">Live Engagement Analysis</p>
            </div>
          </div>

          {/* Score Display */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">Engagement Quality</p>
              <div className={`text-3xl font-black ${score < 80 ? 'text-orange-500' : 'text-[#24cfa6]'}`}>
                {score.toFixed(0)}/100
              </div>
            </div>
          </div>
        </div>

      {/* Push content below navbar */}
      <main className="pt-24 max-w-6xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Video Feed (Expanded) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative bg-zinc-950 rounded-2xl overflow-hidden shadow-none border border-zinc-800 aspect-video flex items-center justify-center">
            {!isModelLoaded && (
              <div className="absolute z-20 flex flex-col items-center text-zinc-500 animate-pulse">
                <Activity className="w-8 h-8 mb-2" />
                <p>Loading Vision Models...</p>
              </div>
            )}

            {!cameraActive && isModelLoaded && (
              <button
                onClick={startWebcam}
                className="absolute z-20 bg-[#24cfa6] hover:bg-[#17e1b2] text-white px-6 py-3 rounded-full font-bold transition-all flex items-center gap-2"
              >
                <Eye className="w-5 h-5" /> Start Monitoring
              </button>
            )}

            {cameraActive && (
              <button
                onClick={stopWebcam}
                className="absolute top-4 right-4 z-20 bg-red-600/80 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm font-bold transition-all flex items-center gap-1 backdrop-blur-sm"
              >
                <EyeOff className="w-4 h-4" /> Stop
              </button>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transform -scale-x-100 transition-opacity ${cameraActive ? 'opacity-100' : 'opacity-40'}`}
            />

            {/* Overlay Indicators */}
            {cameraActive && (
              <div className="absolute top-4 left-4 flex flex-col gap-2">
                {/* Gaze Badge */}
                <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md border ${
                  gazeStatus.includes("Reading")
                    ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-100"
                    : "bg-green-500/20 border-green-500/50 text-green-100"
                }`}>
                  {gazeStatus.includes("Reading") ? <EyeOff size={14} /> : <Eye size={14} />}
                  {gazeStatus}
                </div>

                {/* Debug Info */}
                <div className="bg-black/60 backdrop-blur-md p-2 rounded text-[10px] text-zinc-300 font-mono border border-zinc-700">
                  <div className="flex items-center gap-2 mb-1 border-b border-zinc-700 pb-1">
                    <Bug size={10} /> Metrics
                  </div>
                  <div>Pitch: {debugMetrics.pitchRatio.toFixed(2)}</div>
                  <div>Move Int: {movementIntensity.toFixed(1)}</div>
                </div>
              </div>
            )}

            {/* Anger Warning Overlay */}
            {isAngry && (
              <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-red-900/80 to-transparent">
                <div className="flex justify-between text-white text-sm mb-1 font-bold">
                  <span className="text-red-200 flex items-center gap-2">
                    <ShieldAlert size={16} /> Anger Detected
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Movement & Energy Card */}
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
            <h3 className="font-bold text-zinc-100 mb-4 flex items-center gap-2">
              <Move className="w-5 h-5 text-orange-500" /> Body Movement
            </h3>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-sm">
                <span className={`font-semibold ${movementLabel === 'Stationary' ? 'text-red-400' : 'text-[#24cfa6]'}`}>
                  {movementLabel}
                </span>
                {movementLabel === 'Stationary' && (
                  <span className="text-xs text-red-400 font-mono">
                    {(STATIC_LIMIT_MS / 1000 - staticTimer).toFixed(1)}s to penalty
                  </span>
                )}
              </div>

              {/* Movement Intensity Bar */}
              <div className="w-full bg-zinc-800 h-3 rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-300 ${movementLabel === 'Stationary' ? 'bg-orange-600' : 'bg-green-500'}`}
                  style={{ width: `${movementIntensity}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Keeping high energy recovers score. Staying static for 60s triggers a drop.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Analytics */}
        <div className="space-y-6">
          {/* Emotion Card */}
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
            <h3 className="font-bold text-zinc-100 mb-4 flex items-center gap-2">
              <Smile className="w-5 h-5 text-purple-500" /> Emotional State
            </h3>

            <div className="flex flex-col gap-4 mb-6 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-4">
                <div className="bg-zinc-900 p-3 rounded-full border border-zinc-800">
                  {getEmotionIcon(currentEmotion.label)}
                </div>
                <div>
                  <p className="text-xs text-zinc-500 font-bold uppercase">Dominant Emotion</p>
                  <p className="text-xl font-bold text-zinc-100">{currentEmotion.label}</p>
                </div>
              </div>

              <div className="mt-2 pt-3 border-t border-zinc-800">
                {quickTip ? (
                  <div className="text-xs text-purple-200 bg-purple-900/30 border border-purple-800 p-2 rounded animate-in fade-in slide-in-from-top-2">
                    <span className="font-bold mr-1">💡 Tip:</span> {quickTip}
                    <button onClick={() => setQuickTip(null)} className="ml-2 text-purple-300 hover:text-purple-100 underline">Close</button>
                  </div>
                ) : (
                  <button
                    onClick={getQuickTip}
                    disabled={isTipLoading || !cameraActive}
                    className="w-full py-1.5 px-3 bg-zinc-800 border border-zinc-700 text-purple-400 text-xs font-semibold rounded-lg hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isTipLoading ? 'Asking Gemini...' : `✨ Get advice for "${currentEmotion.label}"`}
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-zinc-500">
              * Focus (+1/1m), Happy (+1/1m), Neutral (-1/3m), Angry (-5/10s)
            </p>
          </div>

          {/* Logs Card */}
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 h-[300px] flex flex-col">
            <h3 className="font-bold text-zinc-100 mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-zinc-500" /> Event Log
            </h3>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {logs.length === 0 ? (
                <p className="text-zinc-500 text-sm italic text-center mt-10">No events recorded yet.</p>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="text-sm p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                    <span className="text-xs font-mono text-zinc-500 block mb-1">{log.time}</span>
                    <span className={
                      log.type === 'error' ? 'text-red-400 font-medium' :
                        log.type === 'success' ? 'text-[#24cfa6] font-medium' :
                          log.type === 'warning' ? 'text-orange-400 font-medium' :
                            'text-zinc-300'
                    }>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Live;
