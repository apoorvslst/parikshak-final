import React, { useState, useEffect, useRef } from "react";
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    arrayUnion
} from "firebase/firestore";
import { useFirebase, app } from "../context/Firebase";
import { useNavigate } from "react-router-dom";
import Logo2 from "../pictures/Logo2.png";

// --- IMPORTS FOR VIDEO ANALYSIS ---
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FaceLandmarker, PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

// --- ICONS ---
const Icons = {
    Video: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>,
    Upload: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>,
    Brain: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"></path><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"></path></svg>,
    Activity: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
};

// 1. WORKER CODE STRING (Xenova Transformers)
const WORKER_CODE = `
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.16.0';

// Disable local models to force download from Hugging Face
env.allowLocalModels = false;

class PipelineSingleton {
    static instance = null;
    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en', { progress_callback });
        }
        return this.instance;
    }
}

self.addEventListener('message', async (event) => {
    const { type, audio } = event.data;
    if (type === 'transcribe') {
        try {
            const transcriber = await PipelineSingleton.getInstance((data) => {
                self.postMessage({ 
                    status: 'loading', 
                    data: { 
                        status: data.status, 
                        progress: data.progress || 0,
                        file: data.file 
                    } 
                });
            });
            
            const output = await transcriber(audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
                callback_function: (item) => {
                    const text = typeof item === 'string' ? item : item.text;
                    self.postMessage({ status: 'partial', text: text });
                }
            });

            self.postMessage({ status: 'complete', text: output.text });

        } catch (err) {
            self.postMessage({ status: 'error', error: err.message });
        }
    }
});
`;

const Upload = ({ userRole }) => {
    // --- STATE MANAGEMENT ---
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const firebase = useFirebase();
    const firestore = getFirestore(app);
    const navigate = useNavigate();
    const { isUserLoggedIn, currentUser } = useFirebase();

    const [teachers, setTeachers] = useState([]);
    const [subject, setSubject] = useState('');
    const [file, setFile] = useState(null);
    const [refmat, setRefmat] = useState("");
    const [transcribedText, setTranscribedText] = useState('');
    const [teachername, setTeachername] = useState('');
    
    // Combined Results
    const [combinedReport, setCombinedReport] = useState(null);
    
    // Status Flags
    const [isUploading, setIsUploading] = useState(false);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);

    // Video Metrics State (Raw data to be sent to Gemini later)
    const [videoMetrics, setVideoMetrics] = useState(null);
    const [videoProgress, setVideoProgress] = useState(0);
    const [videoStatusMsg, setVideoStatusMsg] = useState('');
    const [liveFeedback, setLiveFeedback] = useState({ text: "Ready", color: "text-slate-500", timestamp: "00:00" });

    const workerRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    const GEMINI_API_KEY = import.meta.env.VITE_EXTERNAL_API_KEY;

    // ----------------------------------------------------------------------------------
    // 1. INITIALIZE AUDIO WORKER
    // ----------------------------------------------------------------------------------
    useEffect(() => {
        const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        workerRef.current = new Worker(workerUrl, { type: 'module' });

        workerRef.current.onmessage = (e) => {
            const { status, text, data, error } = e.data;
            if (status === 'loading') {
                if (data && data.status === 'progress') {
                    setTranscribedText(`Downloading Speech Model: ${Math.round(data.progress)}%`);
                } else {
                    setTranscribedText("Initializing Audio AI...");
                }
            } else if (status === 'complete') {
                setIsUploading(false);
                setTranscribedText(text);
            } else if (status === 'error') {
                setIsUploading(false);
                setTranscribedText("Error: " + error);
            }
        };

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
            URL.revokeObjectURL(workerUrl);
        };
    }, []);

    // ----------------------------------------------------------------------------------
    // 2. VIDEO ANALYSIS (Generates Metrics Only - No Gemini Call Here)
    // ----------------------------------------------------------------------------------
    const runVideoAnalysis = async (fileToAnalyze) => {
        if (!fileToAnalyze || !GEMINI_API_KEY) return;

        setIsAnalyzingVideo(true);
        setVideoMetrics(null);
        setLiveFeedback({ text: "Booting Vision AI...", color: "text-slate-400", timestamp: "00:00" });

        try {
            setVideoStatusMsg("Loading Vision Models...");

            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
            );

            const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                    delegate: "GPU"
                },
                outputFaceBlendshapes: true,
                runningMode: "VIDEO",
                numFaces: 1
            });

            const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numPoses: 1
            });

            setVideoStatusMsg("Models Ready. Processing Video...");

            const stats = {
                total_time: 0, focused_sec: 0, reading_sec: 0, board_work_sec: 0, stationary_sec: 0,
                happy_sec: 0, angry_sec: 0, neutral_sec: 0, closed_posture_sec: 0,
                writing_count: 0, movement_scores: [], max_reading_streak: 0, current_reading_streak: 0
            };
            const events = [];

            // Logic Trackers
            let prevNose = null;
            let stationaryFrames = 0;
            let angryFrames = 0;
            const fps = 4;
            const step = 0.25;

            // Sticky Counters & Buckets
            let stickyWriting = 0;
            let stickyPointing = 0;
            let bucket = { writing: 0, pointing: 0, reading: 0, focused: 0, angry: 0, happy: 0, frames: 0 };

            // Load Video
            const videoElement = videoRef.current;
            videoElement.src = URL.createObjectURL(fileToAnalyze);

            await new Promise((resolve) => {
                const checkReady = () => {
                    if (videoElement.readyState >= 1 && Number.isFinite(videoElement.duration)) {
                        resolve();
                        return true;
                    }
                    return false;
                };
                if (checkReady()) return;
                const onLoaded = () => checkReady();
                videoElement.addEventListener('loadedmetadata', onLoaded);
                videoElement.addEventListener('durationchange', onLoaded);
                setTimeout(() => resolve(), 3000);
            });

            stats.total_time = videoElement.duration || 0;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            const drawingUtils = new DrawingUtils(ctx);

            if (!Number.isFinite(stats.total_time) || stats.total_time === 0) throw new Error("Video duration invalid.");

            // --- ANALYSIS LOOP ---
            for (let t = 0; t < stats.total_time; t += step) {
                videoElement.currentTime = t;

                await new Promise(resolve => {
                    const onSeek = () => {
                        videoElement.removeEventListener('seeked', onSeek);
                        resolve();
                    };
                    videoElement.addEventListener('seeked', onSeek);
                    setTimeout(resolve, 300);
                });

                const startTimeMs = t * 1000;
                const faceResult = faceLandmarker.detectForVideo(videoElement, startTimeMs);
                const poseResult = poseLandmarker.detectForVideo(videoElement, startTimeMs);

                // Draw Overlay
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (poseResult.landmarks && poseResult.landmarks.length > 0) {
                    drawingUtils.drawLandmarks(poseResult.landmarks[0], { radius: 3, color: "#ef4444" });
                    drawingUtils.drawConnectors(poseResult.landmarks[0], PoseLandmarker.POSE_CONNECTIONS, { color: "#22c55e", lineWidth: 2 });
                }

                // Metric Calculations
                const timeStr = new Date(t * 1000).toISOString().substr(14, 5);
                let isWriting = false; let isPointing = false; let isReading = false;
                let isAngry = false; let isHappy = false;
                let frameStatus = "Scanning..."; let frameColor = "text-blue-400";

                // Emotion & Gaze
                if (faceResult.faceBlendshapes && faceResult.faceBlendshapes.length > 0) {
                    const cats = faceResult.faceBlendshapes[0].categories;
                    const browDown = ((cats.find(c => c.categoryName === 'browDownLeft')?.score || 0) +
                        (cats.find(c => c.categoryName === 'browDownRight')?.score || 0)) / 2;
                    if (browDown > 0.65) {
                        angryFrames++;
                        if (angryFrames >= (10 * fps)) {
                            isAngry = true;
                            if (angryFrames === (10 * fps)) events.push({ time: timeStr, type: "Emotion", desc: "😠 Sustained Anger" });
                        }
                    } else { angryFrames = 0; }

                    const smile = ((cats.find(c => c.categoryName === 'mouthSmileLeft')?.score || 0) +
                        (cats.find(c => c.categoryName === 'mouthSmileRight')?.score || 0)) / 2;
                    if (smile > 0.5) { isHappy = true; stats.happy_sec += step; }

                    const lookDownScore = ((cats.find(c => c.categoryName === 'eyeLookDownLeft')?.score || 0) +
                        (cats.find(c => c.categoryName === 'eyeLookDownRight')?.score || 0)) / 2;
                    if (lookDownScore > 0.75) isReading = true;
                }

                // Pose & Movement
                if (poseResult.landmarks && poseResult.landmarks.length > 0) {
                    const pose = poseResult.landmarks[0];
                    const nose = pose[0];
                    const lWrist = pose[15]; const rWrist = pose[16];
                    const lShoulder = pose[11]; const rShoulder = pose[12];

                    if (prevNose) {
                        const dist = Math.sqrt(Math.pow(nose.x - prevNose.x, 2) + Math.pow(nose.y - prevNose.y, 2));
                        stats.movement_scores.push(Math.min(100, dist * 5000));
                        if (dist < 0.005) {
                            stats.stationary_sec += step;
                            stationaryFrames++;
                            if (stationaryFrames === (30 * fps)) events.push({ time: timeStr, type: "Engagement", desc: "Stationary > 30s" });
                        } else { stationaryFrames = 0; }
                    }
                    prevNose = nose;

                    const wristDist = Math.abs(lWrist.x - rWrist.x);
                    if (wristDist < 0.2 && lWrist.y > lShoulder.y) stats.closed_posture_sec += step;

                    if (lWrist.y < lShoulder.y || rWrist.y < rShoulder.y) stickyWriting = 4;
                    if (Math.abs(lWrist.x - lShoulder.x) > 0.25 || Math.abs(rWrist.x - rShoulder.x) > 0.25) stickyPointing = 4;
                }

                if (stickyWriting > 0) { isWriting = true; stats.board_work_sec += step; stats.writing_count++; stickyWriting--; } 
                else if (stickyPointing > 0) { isPointing = true; stats.writing_count += 0.5; stickyPointing--; }

                if (isWriting) { bucket.writing++; frameStatus = "✍️ Writing on Board"; frameColor = "text-purple-400"; }
                else if (isPointing) { bucket.pointing++; frameStatus = "👉 Pointing / Gesturing"; frameColor = "text-indigo-400"; }
                else if (isAngry) { bucket.angry++; stats.angry_sec += step; frameStatus = "😠 Expression: Angry"; frameColor = "text-red-500"; }
                else if (isReading) { 
                    bucket.reading++; stats.reading_sec += step; stats.current_reading_streak += step;
                    if (stats.current_reading_streak > stats.max_reading_streak) stats.max_reading_streak = stats.current_reading_streak;
                    frameStatus = "👀 Reading / Looking Down"; frameColor = "text-yellow-400"; 
                } else {
                    stats.current_reading_streak = 0; stats.focused_sec += step; bucket.focused++;
                    if (isHappy) { bucket.happy++; frameStatus = "😊 Happy / Smiling"; frameColor = "text-green-300"; }
                    else { stats.neutral_sec += step; frameStatus = "✅ Focused on Class"; frameColor = "text-green-400"; }
                }
                bucket.frames++;

                // Timeline Event
                if (Math.floor(t) % 5 === 0 && Math.floor(t) !== Math.floor(t - step)) {
                    let type = "Engagement"; let desc = "Teaching (Focused)";
                    if (bucket.writing > 2) { type = "Board Work"; desc = "Writing on Board"; }
                    else if (bucket.pointing > 2) { type = "Gesture"; desc = "Pointing / Explaining"; }
                    else if (bucket.angry > 2) { type = "Emotion"; desc = "Stern/Angry Expression"; }
                    else if (bucket.happy > 2) { type = "Emotion"; desc = "Smiling / Positive"; }
                    else if (bucket.reading > (bucket.frames * 0.5)) { type = "Gaze"; desc = "Reading Notes"; }
                    events.push({ time: timeStr, type, desc });
                    bucket = { writing: 0, pointing: 0, reading: 0, focused: 0, angry: 0, happy: 0, frames: 0 };
                }

                setLiveFeedback({ text: frameStatus, color: frameColor, timestamp: timeStr });
                setVideoProgress(Math.round((t / stats.total_time) * 100));
            }

            // --- CALCULATE FINAL VIDEO METRICS ---
            setVideoStatusMsg("Video Analysis Complete. Ready for Evaluation.");
            setLiveFeedback({ text: "Processing Done", color: "text-blue-400", timestamp: "DONE" });

            const dur = stats.total_time || 1;
            const focusRatio = (stats.focused_sec / dur);
            const readingRatio = (stats.reading_sec / dur);
            const boardRatio = (stats.board_work_sec / dur);
            const postureRatio = (stats.closed_posture_sec / dur);
            const happyRatio = (stats.happy_sec / dur);
            const angryRatio = (stats.angry_sec / dur);

            setVideoMetrics({
                metrics: { focusRatio, readingRatio, boardRatio, happyRatio, angryRatio, postureRatio },
                stats: stats,
                events: events,
                raw_duration: dur
            });

        } catch (error) {
            console.error(error);
            setVideoStatusMsg("Video Analysis Error: " + error.message);
        } finally {
            setIsAnalyzingVideo(false);
        }
    };

    // ----------------------------------------------------------------------------------
    // 3. COMBINED EVALUATION (TEXT + VIDEO)
    // ----------------------------------------------------------------------------------
    const handleGeminiEvaluate = async () => {
        try {
            if (!transcribedText || transcribedText.trim().length === 0) {
                alert("Please wait for audio transcription to complete.");
                return;
            }
            if (!refmat || refmat.trim().length === 0) {
                alert("Please paste reference material before evaluating.");
                return;
            }
            if (!videoMetrics) {
                // Warning if video analysis isn't done, but proceed if they insist? 
                // For now, let's assume they want the combined report.
                if(!confirm("Video analysis is not yet complete. Proceed with text-only evaluation?")) return;
            }

            setIsEvaluating(true);
            setVideoStatusMsg("Generating Combined Report with Gemini...");

            // --- SYSTEM PROMPT (With Repetition Handling) ---
            const systemPrompt = `
            You are "Parikshak AI", an expert pedagogical coach evaluating a teacher based on two data sources:
            1. An Audio Transcript of their lecture.
            2. Video Behavioral Metrics (gaze, emotion, gestures).

            CRITICAL INSTRUCTION ON TRANSCRIPT REPETITION:
            The audio transcript is generated by an automated Whisper model which frequently hallucinates and repeats phrases (e.g., "Okay okay okay" or repeating the last sentence). 
            You must INTELLIGENTLY FILTER out these repetitions. Do not penalize the teacher for model errors. Focus on the distinct semantic concepts delivered.

            Return ONLY strict JSON with the following schema:
            {
              "subject": "Inferred Subject (1-3 words)",
              "overall_rating": (Float 0-5),
              "improvement_percentage": (Integer),
              "metrics": {
                "clarity_score": (Integer 0-100),
                "example_quality": (Integer 0-100),
                "doubt_resolution": (Integer 0-100),
                "voice_sentiment": (Integer 0-100),
                "syllabus_completion": (Integer 0-100),
                "content_simplification": (Integer 0-100),
                "student_engagement": (Integer 0-100),
                "Areas to Improve": "Specific feedback",
                "Way to improve": "Actionable tips"
              },
              "video_analysis": {
                 "body_language_score": (Integer 0-100),
                 "visual_summary": "Summary of their physical teaching style based on video metrics"
              },
              "timeline_narrative": "A brief story of the class flow based on the timeline events"
            }
            `;

            // --- USER PROMPT (Combining Data) ---
            const userPrompt = `
            TRANSCRIPT (Ignore repetitions):
            ${transcribedText.substring(0, 20000)} ... [truncated if too long]

            REFERENCE MATERIAL:
            ${refmat}

            VIDEO METRICS:
            ${videoMetrics ? JSON.stringify(videoMetrics.metrics) : "No video data"}

            TIMELINE EVENTS:
            ${videoMetrics ? JSON.stringify(videoMetrics.events) : "No timeline data"}

            Evaluate the teacher comprehensively.
            `;

            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
            const resp = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: userPrompt }] }],
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    generationConfig: { responseMimeType: "application/json" }
                })
            });

            if (!resp.ok) throw new Error(`Gemini API error ${resp.status}`);

            const result = await resp.json();
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

            let parsed;
            try {
                parsed = JSON.parse(text);
            } catch (e) {
                const match = text.match(/\{[\s\S]*\}/);
                if (match) parsed = JSON.parse(match[0]);
                else throw new Error("Could not parse JSON");
            }

            setCombinedReport(parsed);

            // UPDATE FIRESTORE
            if(teachername) {
                const teacherRef = doc(firestore, "teachers", teachername);
                const teacherSnap = await getDoc(teacherRef);
                const newRating = parsed.overall_rating;
                const newTopic = parsed.subject;
                const payload = { rating: arrayUnion(newRating), topics: arrayUnion(newTopic) };
                
                if (teacherSnap.exists()) await updateDoc(teacherRef, payload);
                else await setDoc(teacherRef, { name: teachername, rating: [newRating], topics: [newTopic] });
            }

        } catch (err) {
            console.error("Gemini error:", err);
            alert("Evaluation failed. See console.");
        } finally {
            setIsEvaluating(false);
        }
    };

    // --- RENDER HELPERS ---
    const MetricCard = ({ label, value, color = "text-white" }) => (
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
    );

    // --- EVENT HANDLERS ---
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            
            // 1. START TEXT TRANSCRIPTION (Background)
            setIsUploading(true);
            transcribeMedia(selectedFile).catch(err => {
                console.error("Transcription failed:", err);
                setIsUploading(false);
            });

            // 2. START VIDEO ANALYSIS (Background)
            runVideoAnalysis(selectedFile);
        }
    };

    const transcribeMedia = async (fileToTranscribe) => {
        if (!fileToTranscribe || !workerRef.current) return;
        setTranscribedText("Reading audio...");
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const arrayBuffer = await fileToTranscribe.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const audioData = audioBuffer.getChannelData(0);

        setTranscribedText("Audio decoded. Transcribing...");
        workerRef.current.postMessage({ type: 'transcribe', audio: audioData });
    };

    // Navigation & UI Handlers
    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
    const handleNavigation = (path) => { navigate(path); if (isMenuOpen) setIsMenuOpen(false); };
    useEffect(() => {
        const fetchTeachers = async () => {
            const querySnapshot = await getDocs(collection(firestore, "teachers"));
            setTeachers(querySnapshot.docs.map((doc) => doc.data().name));
        };
        fetchTeachers();
    }, [firestore]);


    return (
        <div>
            {/* STYLES */}
            <style>
                {`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #1e293b; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
                .scan-line {
                    position: absolute; top: 0; left: 0; width: 100%; height: 3px;
                    background: #3b82f6; box-shadow: 0 0 15px #3b82f6;
                    animation: scan 2.5s linear infinite; z-index: 20; opacity: 0.8;
                }
                @keyframes scan { 0% { top: 0%; } 100% { top: 100%; } }
                `}
            </style>

            <section className="w-full flex flex-col items-center justify-around bg-black text-white text-center pt-20 relative overflow-hidden min-h-screen">
                <div className="absolute top-[-150px] right-[-50px] w-[350px] h-[350px] bg-[#24cfa6] rounded-full blur-[160px] opacity-70"></div>
                                <div className="absolute bottom-[-150px] left-[-150px] w-[350px] h-[350px] bg-[#24cfa6] rounded-full blur-[160px] opacity-70"></div>
                
                                <nav className="fixed top-0 left-0 w-full flex bg-transparent justify-between text-white z-20">
                                    <div className="left flex flex-row items-center p-2 sm:p-0">
                                        <img className="w-14 h-14 sm:w-16 sm:h-16 ms-4 mt-4 sm:ms-20 object-cover scale-180 origin-center" src={Logo2} alt="Logo" />
                                        <div className="name mt-0 sm:mt-7 mx-2 sm:mx-5 text-base sm:text-lg font-medium">Parikshak AI</div>
                                    </div>
                
                                    {/* Desktop Navigation */}
                                    <div className="right hidden sm:flex flex-row justify-around items-center">
                                        <span className="mx-6 cursor-pointer" onClick={() => handleNavigation("/")}>Home</span>
                                        
                                        {/* ROLE SPECIFIC: Student/Admin only see Insights */}
                                        {userRole === "Student/Admin" && (
                                            <span onClick={() => handleNavigation("/insights")} className="mx-6 cursor-pointer">Insights</span>
                                        )}
                                        
                                        <span onClick={() => handleNavigation('/textanalysis')} className="mx-6 cursor-pointer">Upload & Analyse</span>
                                        <span onClick={() => handleNavigation("/live")} className="mx-6 cursor-pointer">Live Monitor</span>
                                        <span onClick={() => handleNavigation("/audio")} className="mx-6 cursor-pointer">Audio Analysis</span>
                                        
                                        {/* ROLE SPECIFIC: Swap Feedback and Doubts */}
                                        {userRole === "Student/Admin" ? (
                                            <span onClick={() => handleNavigation("/feedback")} className="mx-6 cursor-pointer">Feedback</span>
                                        ) : (
                                            <span onClick={() => handleNavigation("/doubts")} className="mx-6 cursor-pointer">Doubts</span>
                                        )}
                
                                        {isUserLoggedIn ? (
                  currentUser?.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="User Profile"
                      className="mx-10 w-10 h-10 rounded-full border border-white cursor-pointer"
                      onClick={() => handleNavigation("/profile")}
                    />
                  ) : (
                    <div
                      className="mx-10 w-10 h-10 rounded-full border border-white flex items-center justify-center cursor-pointer bg-zinc-800"
                      onClick={() => handleNavigation("/profile")}
                    >
                      👤
                    </div>
                  )
                ) : (
                  <button>Sign In</button>
                )}
                
                                    </div>
                
                                    {/* Mobile Menu Button */}
                                    <div className="flex items-center sm:hidden me-4">
                                        {isUserLoggedIn ? (
                                            <img src={currentUser?.photoURL || useravatar} className="w-8 h-8 rounded-full border border-white me-4 cursor-pointer" onClick={() => handleNavigation("/profile")} />
                                        ) : (
                                            <button className="bg-[#24cfa6] h-8 w-16 rounded text-black text-sm font-medium me-4" onClick={() => handleNavigation("/login")}>Sign In</button>
                                        )}
                                        <button className="text-white text-2xl focus:outline-none" onClick={toggleMenu}>
                                            {isMenuOpen ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                                            )}
                                        </button>
                                    </div>
                                </nav>
                
                                {/* Mobile Menu Dropdown */}
                                <div className={`fixed top-16 left-0 w-full bg-black/95 backdrop-blur-sm z-10 sm:hidden transition-all duration-300 ease-in-out ${isMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                    <div className="flex flex-col items-center py-4 space-y-3">
                                        <span className="w-full text-center py-2 hover:bg-[#24cfa6]/20 cursor-pointer text-lg">Home</span>
                                        
                                        {userRole === "Student/Admin" && (
                                            <span onClick={() => handleNavigation("/insights")} className="w-full text-center py-2 hover:bg-[#24cfa6]/20 cursor-pointer text-lg">Insights</span>
                                        )}
                
                                        <span onClick={() => handleNavigation('/textanalysis')} className="w-full text-center py-2 hover:bg-[#24cfa6]/20 cursor-pointer text-lg">Upload & Analyse</span>
                                        <span onClick={() => handleNavigation("/live")} className="w-full text-center py-2 hover:bg-[#24cfa6]/20 cursor-pointer text-lg">Live Monitor</span>
                                        <span onClick={() => handleNavigation("/audio")} className="w-full text-center py-2 hover:bg-[#24cfa6]/20 cursor-pointer text-lg">Audio Analysis</span>
                                        
                                        {userRole === "Student/Admin" ? (
                                            <span onClick={() => handleNavigation("/feedback")} className="w-full text-center py-2 hover:bg-[#24cfa6]/20 cursor-pointer text-lg">Feedback</span>
                                        ) : (
                                            <span onClick={() => handleNavigation("/doubts")} className="w-full text-center py-2 hover:bg-[#24cfa6]/20 cursor-pointer text-lg">Doubts</span>
                                        )}
                                    </div>
                                </div>
                                <div className="instructions flex flex-col items-center md:flex-row md:justify-around w-full max-w-4xl mt-10 p-4 gap-4 text-white">

                    <div className="step flex flex-col items-center bg-gray-900 rounded-lg p-4 shadow-md w-full md:w-48 text-center">

                        <div className="step-number w-10 h-10 flex items-center justify-center bg-[#24cfa6] rounded-full text-black font-bold mb-2">1</div>

                        <span className="font-semibold text-md">Select teacher and topic</span>

                        <p className="text-gray-400 mt-1 text-sm">Choose the teacher and topic</p>

                    </div>



                    <div className="step flex flex-col items-center bg-gray-900 rounded-lg p-4 shadow-md w-full md:w-48 text-center">

                        <div className="step-number w-10 h-10 flex items-center justify-center bg-[#24cfa6] rounded-full text-black font-bold mb-2">2</div>

                        <span className="font-semibold text-md">Upload audio/video recording</span>

                        <p className="text-gray-400 mt-1 text-sm">Provide your recording for analysis</p>

                    </div>



                    <div className="step flex flex-col items-center bg-gray-900 rounded-lg p-4 shadow-md w-full md:w-48 text-center">

                        <div className="step-number w-10 h-10 flex items-center justify-center bg-[#24cfa6] rounded-full text-black font-bold mb-2">3</div>

                        <span className="font-semibold text-md">Add Reference Material</span>

                        <p className="text-gray-400 mt-1 text-sm">Attach any supplementary material</p>

                    </div>

                </div>

                {/* MAIN CONTENT */}
                <div className="w-full max-w-7xl px-4 mt-8 flex flex-col items-center z-10">
                    
                    {/* 1. INPUT SECTION */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl mb-8">
                        <div className="flex flex-col gap-4">
                            <label className="font-medium text-left">Select Teacher & Subject</label>
                            <input list="teachers" onChange={(e) => setTeachername(e.target.value)} className="border p-2 rounded text-white bg-black/50" placeholder="Teacher Name..." />
                            <datalist id="teachers">{teachers.map((name, i) => <option key={i} value={name} />)}</datalist>
                            <input type="text" onChange={(e) => setSubject(e.target.value)} placeholder="Subject..." className="border p-2 rounded text-white bg-black/50" />
                            
                            <label className="font-medium text-left mt-2">Upload Video</label>
                            <input type="file" accept="video/*" className="border p-2 rounded text-white bg-black/50" onChange={handleFileChange} />
                        </div>
                        <div className="flex flex-col">
                            <label className="font-medium text-left mb-2">Reference Material</label>
                            <textarea onChange={(e) => setRefmat(e.target.value)} className="border p-2 rounded text-white bg-black/50 h-full min-h-[200px]" placeholder="Paste reference content here..."></textarea>
                        </div>
                    </div>

                    {/* 2. VIDEO PREVIEW (Visual Feedback) */}
                    <div className="w-full max-w-4xl relative bg-black rounded-2xl overflow-hidden border border-slate-800 aspect-video flex items-center justify-center mb-8 shadow-2xl">
                        {!file && <p className="text-slate-600">Video Preview</p>}
                        <video ref={videoRef} className="w-full h-full object-contain" muted playsInline></video>
                        <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none"></canvas>
                        
                        {isAnalyzingVideo && (
                            <>
                                <div className="scan-line"></div>
                                <div className="absolute top-4 left-4 bg-black/80 backdrop-blur px-4 py-2 rounded-lg border border-slate-700 z-30 text-left">
                                    <span className={`text-sm font-bold ${liveFeedback.color}`}>{liveFeedback.text}</span>
                                    <p className="text-xs text-slate-400">{videoStatusMsg}</p>
                                </div>
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-gray-800">
                                    <div className="h-full bg-[#24cfa6] transition-all duration-300" style={{ width: `${videoProgress}%` }}></div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* 3. EVALUATE BUTTON */}
                    <button
                        onClick={handleGeminiEvaluate}
                        
                        className={`text-white bg-[#24cfa6] h-12 w-64 rounded-full font-bold text-lg hover:bg-[#1ba988] transition shadow-lg mb-12 ${isEvaluating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={isEvaluating}
                    >
                        {isEvaluating ? "Generating Combined Report..." : "Evaluate Content & Video"}
                    </button>

                    {/* 4. RESULTS DISPLAY */}
                    {combinedReport && (
                        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 mb-20 animate-in fade-in slide-in-from-bottom-8">
                            
                            {/* Score & Metrics Card */}
                            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-left">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-3xl font-bold text-[#24cfa6]">Overall Rating</h2>
                                        <p className="text-slate-400">{combinedReport.subject}</p>
                                    </div>
                                    <div className="text-5xl font-black text-white">{combinedReport.overall_rating}<span className="text-xl text-slate-500">/5</span></div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <MetricCard label="Engagement" value={combinedReport.metrics.student_engagement} />
                                    <MetricCard label="Clarity" value={combinedReport.metrics.clarity_score} />
                                    <MetricCard label="Body Language" value={combinedReport.video_analysis?.body_language_score || "N/A"} color="text-yellow-400" />
                                    <MetricCard label="Simplify" value={combinedReport.metrics.content_simplification} />
                                </div>
                                
                                <div className="bg-slate-800 p-4 rounded-xl">
                                    <h3 className="text-lg font-bold text-[#24cfa6] mb-2">Video Visual Summary</h3>
                                    <p className="text-slate-300 text-sm">{combinedReport.video_analysis?.visual_summary}</p>
                                </div>
                            </div>

                            {/* Narrative & Timeline Card */}
                            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-left overflow-y-auto max-h-[600px] custom-scrollbar">
                                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Icons.Brain /> Qualitative Analysis</h3>
                                
                                <div className="mb-6">
                                    <h4 className="text-[#24cfa6] font-bold text-sm uppercase mb-2">Timeline Narrative</h4>
                                    <p className="text-slate-300 text-sm leading-relaxed">{combinedReport.timeline_narrative}</p>
                                </div>

                                <div className="mb-6">
                                    <h4 className="text-red-400 font-bold text-sm uppercase mb-2">Areas to Improve</h4>
                                    <p className="text-slate-300 text-sm">{combinedReport.metrics["Areas to Improve"]}</p>
                                </div>

                                <div className="mb-6">
                                    <h4 className="text-green-400 font-bold text-sm uppercase mb-2">Ways to Improve</h4>
                                    <p className="text-slate-300 text-sm">{combinedReport.metrics["Way to improve"]}</p>
                                </div>
                                
                                {/* Raw Timeline Events from Video */}
                                {videoMetrics && (
                                    <div className="mt-6 border-t border-slate-700 pt-4">
                                        <h4 className="text-slate-500 font-bold text-xs uppercase mb-3">Detected Events</h4>
                                        <div className="space-y-2">
                                            {videoMetrics.events.slice(0, 5).map((ev, i) => (
                                                <div key={i} className="flex gap-2 text-xs text-slate-400">
                                                    <span className="font-mono text-[#24cfa6]">{ev.time}</span>
                                                    <span>{ev.desc}</span>
                                                </div>
                                            ))}
                                            {videoMetrics.events.length > 5 && <p className="text-xs text-slate-600 italic">...and {videoMetrics.events.length - 5} more events</p>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default Upload;