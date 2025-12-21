import React, { useState, useEffect, useRef } from 'react';
import { useFirebase } from "../context/Firebase";
import { useNavigate } from "react-router-dom";
import Logo2 from "../pictures/Logo2.png";
import { 
    Mic, Upload, Activity, FileAudio, Play, 
    AlertCircle, RotateCcw, WifiOff, Heart, 
    BarChart3, Lock, BrainCircuit, Users, 
    GraduationCap, MessageCircle, CheckCircle2,
    HelpCircle, BookOpen, Zap, Gauge,
    Waves, MoveRight, Mic2, Cpu, PartyPopper, Users2, Clock, Server, Download, Key, Link, AlertTriangle, Volume2
} from 'lucide-react';

// --- CONSTANTS & CONFIG (From Second Code) ---
const DEFAULT_GOOGLE_KEY = "AIzaSyDY4_R3-vDIEGCfrsBGywPYNMkYQC_k6rI"; // Updated Key
const DEFAULT_SERVER_URL = "https://knaggy-nonadhesively-aaliyah.ngrok-free.dev"; 

const Audio = ({ userRole }) => {
    // --- NAVIGATION STATE (From First Code - Preserved) ---
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const firebase = useFirebase();
    const navigate = useNavigate();
    const { isUserLoggedIn, currentUser } = useFirebase();

    // --- ANALYSIS STATE (From Second Code) ---
    const [googleKey, setGoogleKey] = useState(DEFAULT_GOOGLE_KEY);
    const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
    
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState("idle"); 
    const [logs, setLogs] = useState([]);
    const [results, setResults] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [downloadProgress, setDownloadProgress] = useState(null);
    
    // Libs & Models loaded dynamically
    const [Pitchfinder, setPitchfinder] = useState(null);
    const [Transformers, setTransformers] = useState(null); 
    const [astClassifier, setAstClassifier] = useState(null); 

    // --- EFFECTS & LOGIC (From Second Code) ---

    useEffect(() => {
        const loadLibs = async () => {
            try {
                // 1. Load Pitchfinder (Signal Analysis)
                const pfModule = await import('https://esm.sh/pitchfinder@2.3.0');
                setPitchfinder(pfModule);

                // 2. Load Transformers.js (For Local Noise/Atmosphere Analysis)
                addLog("⏳ Loading Transformers.js...");
                const tfModule = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
                
                tfModule.env.allowLocalModels = false;
                tfModule.env.useBrowserCache = true;
                setTransformers(tfModule);

                // 3. Pre-load AST Model (Atmosphere) ONCE
                addLog("⏳ Downloading AST Model (Noise Analysis)...");
                const MODEL_ID = 'Xenova/ast-finetuned-audioset-10-10-0.4593';
                
                const classifier = await tfModule.pipeline('audio-classification', MODEL_ID, {
                    quantized: true,
                    progress_callback: (data) => {
                        if (data.status === 'progress' && Math.round(data.progress) % 10 === 0) {
                            if (Math.round(data.progress) < 100) {
                                addLog(`Downloading Local Model: ${Math.round(data.progress)}%`);
                            }
                        }
                    }
                });
                
                setAstClassifier(() => classifier);
                addLog("✅ Local Engines Ready");
            } catch (e) {
                console.error("Failed to load libraries:", e);
                addLog("⚠️ Warning: Local libraries failed. Functionality limited.");
            }
        };
        loadLibs();
    }, []);

    const addLog = (msg) => setLogs(prev => [...prev, msg]);

    // --- NAVIGATION HANDLERS (From First Code) ---
    const handleNavigation = (path) => {
        navigate(path);
        if (isMenuOpen) setIsMenuOpen(false);
    };

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    // --- FILE HANDLERS (From Second Code) ---
    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setFile(e.target.files[0]);
            setAudioUrl(URL.createObjectURL(e.target.files[0]));
            setResults(null);
            setLogs([]);
            setStatus("idle");
            setDownloadProgress(null);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // --- HELPER: BUFFER TO WAV (From Second Code) ---
    const bufferToWav = async (abuffer, len) => {
        const numOfChan = abuffer.numberOfChannels;
        const length = len * numOfChan * 2 + 44;
        const buffer = new ArrayBuffer(length);
        const view = new DataView(buffer);
        const channels = [];
        let i;
        let sample;
        let offset = 0;
        let pos = 0;

        const setUint32 = (data) => { view.setUint32(pos, data, true); pos += 4; }
        const setUint16 = (data) => { view.setUint16(pos, data, true); pos += 2; }

        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"

        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16); // length = 16
        setUint16(1); // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(abuffer.sampleRate);
        setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2); // block-align
        setUint16(16); // 16-bit 

        setUint32(0x61746164); // "data" - chunk
        setUint32(length - pos - 4); // chunk length

        for (i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));

        const CHUNK_SIZE = 4096;
        for (let k = 0; k < len; k+=CHUNK_SIZE) {
            const end = Math.min(k + CHUNK_SIZE, len);
            for (let j = k; j < end; j++) {
                for (i = 0; i < numOfChan; i++) {
                    sample = Math.max(-1, Math.min(1, channels[i][offset])); 
                    sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; 
                    view.setInt16(pos, sample, true); 
                    pos += 2;
                }
                offset++;
            }
            if (k % (CHUNK_SIZE * 5) === 0) await new Promise(resolve => setTimeout(resolve, 0));
        }

        return new Blob([buffer], { type: "audio/wav" });
    };

    const mapDimensionsToLabel = (arousal, valence) => {
        if (arousal >= 0.5 && valence >= 0.5) return "Happy/Excited";
        if (arousal >= 0.5 && valence < 0.5) return "Angry/Frustrated";
        if (arousal < 0.5 && valence >= 0.5) return "Calm/Relaxed";
        if (arousal < 0.5 && valence < 0.5) return "Sad/Bored";
        return "Neutral";
    };

    // --- SERVER-SIDE ANALYSIS (Emotions & Disturbance Segments) ---
    const runServerAnalysis = async (audioFile) => {
        if (!serverUrl) {
            addLog("⚠️ No Server URL provided. Skipping server analysis.");
            return null;
        }

        const cleanUrl = serverUrl.replace(/\/$/, ""); 
        const API_ENDPOINT = `${cleanUrl}/analyze`; 
        
        addLog(`🌐 Uploading full audio to Colab Backend (${(audioFile.size / 1024 / 1024).toFixed(2)} MB)...`);

        const formData = new FormData();
        formData.append('file', audioFile);

        try {
            const response = await fetch(API_ENDPOINT, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                if (response.status === 404) throw new Error("Endpoint not found (404). Check Server URL.");
                if (response.status === 502) throw new Error("Bad Gateway (502). Ngrok tunnel might be down.");
                throw new Error(`Server Error ${response.status}`);
            }

            const data = await response.json();
            
            if (data.results && Array.isArray(data.results)) {
                addLog(`✅ Server returned ${data.total_chunks} analyzed segments.`);
                
                // Map server results to our internal structure
                return data.results.map(chunk => ({
                    start: chunk.start,
                    end: chunk.end,
                    emotion: mapDimensionsToLabel(chunk.emotions.arousal, chunk.emotions.valence),
                    confidence: (chunk.emotions.arousal + chunk.emotions.dominance) / 2, 
                    raw_emotion: chunk.emotions,
                    // Check for server-provided disturbance/noise tags in the chunk
                    server_disturbances: chunk.disturbances || chunk.noise_events || [] 
                }));
            }
            return [];

        } catch (e) {
            console.error("Server error:", e);
            addLog(`❌ Server Analysis Failed: ${e.message}. Is Colab running?`);
            return null; 
        }
    };

    // --- AST ATMOSPHERE ANALYSIS (Local) ---
    const runAtmosphereAnalysis = async (audioBuffer) => {
        if (!astClassifier) {
            addLog("⚠️ AST Model not ready.");
            return [];
        }
        
        try {
            const chunkDuration = 5; 
            const disturbances = [];
            const duration = audioBuffer.duration;
            const rawData = audioBuffer.getChannelData(0);
            
            const NOISE_LABELS = ['applause', 'clapping', 'cheering', 'crowd', 'chatter', 'talk', 'noise', 'laughter', 'cough', 'sneeze', 'slam'];
            
            // Analyze segments
            for (let t = 0; t < duration; t += chunkDuration) {
                const startSample = Math.floor(t * audioBuffer.sampleRate);
                const endSample = Math.min(Math.floor((t + chunkDuration) * audioBuffer.sampleRate), rawData.length);
                
                if (endSample - startSample < 1000) continue;

                const chunk = rawData.slice(startSample, endSample);
                const output = await astClassifier(chunk, { sampling_rate: audioBuffer.sampleRate });
                
                const top = output[0]; 
                const label = top.label.toLowerCase();
                
                if (NOISE_LABELS.some(l => label.includes(l)) && top.score > 0.25) {
                    if (label.includes('speech') && !label.includes('crowd')) continue; // Skip normal speech
                    disturbances.push({ time: t, type: top.label, confidence: top.score });
                }
                
                if (t % (chunkDuration * 2) === 0) await new Promise(r => setTimeout(r, 0));
            }

            // Deduplicate
            const uniqueDisturbances = [];
            let lastTime = -10;
            disturbances.forEach(d => {
                if (d.time - lastTime > 5) { 
                    uniqueDisturbances.push(d);
                    lastTime = d.time;
                }
            });

            return uniqueDisturbances;

        } catch (e) {
            console.error("AST Error:", e);
            return [];
        }
    };

    // --- BUCKET DISTURBANCES INTO 30s SEGMENTS ---
    const generateDisturbanceTimeline = (totalDuration, serverTimeline, localDisturbances) => {
        const segments = [];
        const segmentDuration = 30;

        for (let t = 0; t < totalDuration; t += segmentDuration) {
            const end = Math.min(t + segmentDuration, totalDuration);
            
            // 1. Check Server Data for this time slice
            const serverChunk = serverTimeline?.find(c => c.start >= t && c.start < end);
            const serverEvents = serverChunk?.server_disturbances || [];

            // 2. Check Local AST Data for this time slice
            const localEvents = localDisturbances
                .filter(d => d.time >= t && d.time < end)
                .map(d => d.type);

            // 3. Merge & Dedupe
            const allEvents = [...new Set([...serverEvents, ...localEvents])];

            segments.push({
                start: t,
                end: end,
                hasDisturbance: allEvents.length > 0,
                events: allEvents,
                source: serverEvents.length > 0 ? "Server" : "Local"
            });
        }
        return segments;
    };

    // --- SIGNAL PROCESSING ---
    const calculateAudioFeatures = async (file) => {
        if (!Pitchfinder) return null;
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const data = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        // Simple Pitch/Energy calculation
        let sumSquares = 0;
        const detectPitch = Pitchfinder.YIN({ sampleRate });
        const pitches = [];
        const step = 8192;
        let iteration = 0;
        
        for (let i = 0; i < data.length; i += step) {
            const chunk = data.slice(i, i + 2048);
            if(chunk.length < 2048) break;
            let sum = 0;
            for(let s of chunk) sum += s*s;
            sumSquares += sum;
            const p = detectPitch(chunk);
            if(p && p>60 && p<500) pitches.push(p);
            iteration++;
            if (iteration % 50 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        const avgRMS = Math.sqrt(sumSquares / (data.length / (step/2048))); 
        const avgPitch = pitches.length ? pitches.reduce((a,b)=>a+b,0)/pitches.length : 0;
        const estimatedPace = (pitches.length / (audioBuffer.duration / 60)) * 2; 

        return { avgRMS, avgPitch, estimatedPace, audioBuffer };
    };

    // Convert file to Base64
    const fileToGenerativePart = async (file) => {
        const base64EncodedDataPromise = new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });
        return {
            inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
        };
    };

    const runAnalysis = async () => {
        if (!file) return;
        setStatus("processing");
        setLogs([]);
        setDownloadProgress(0); 
        
        try {
            addLog("⚙️ Initializing Pipeline...");
            
            // 1. SIGNAL PROCESSING
            addLog("📊 Processing Signal Metrics (Local)...");
            const signalMetrics = await calculateAudioFeatures(file);
            const { audioBuffer } = signalMetrics;
            addLog(`✅ Signal: ${Math.round(signalMetrics.avgPitch)}Hz | ${Math.round(signalMetrics.estimatedPace)} bpm`);

            // 2. SERVER ANALYSIS (Wav2Vec2 Emotions + Disturbance Segments)
            let serverTimeline = await runServerAnalysis(file);
            
            // 3. BACKGROUND NOISE (Local AST) - Run as backup/enhancement
            let localDisturbances = [];
            if (astClassifier) {
                addLog("🎉 Running Detailed Noise Analysis (Local AST)...");
                localDisturbances = await runAtmosphereAnalysis(audioBuffer);
                if (localDisturbances.length > 0) addLog(`⚠️ Detected ${localDisturbances.length} specific noise events locally.`);
            }

            // 4. CONSOLIDATE DATA
            const disturbanceTimeline = generateDisturbanceTimeline(audioBuffer.duration, serverTimeline, localDisturbances);

            // 5. CLOUD ANALYSIS (LLM)
            addLog("📤 Uploading to LLM Engine...");
            const audioPart = await fileToGenerativePart(file);

            addLog("🤖 Generating Final Pedagogical Report...");
            
            const emotionContext = serverTimeline ? JSON.stringify(serverTimeline.map(s => ({ t: `${s.start}-${s.end}s`, e: s.emotion }))) : "N/A";
            const disturbanceContext = JSON.stringify(disturbanceTimeline.filter(d => d.hasDisturbance).map(d => ({ t: `${d.start}-${d.end}s`, events: d.events })));

            const prompt = `
            Analyze this classroom audio.
            
            DATA:
            - Emotion Timeline (30s chunks): ${emotionContext}
            - Disturbance Timeline (30s chunks): ${disturbanceContext}
            - Pitch: ${Math.round(signalMetrics.avgPitch)}Hz
            - Pace: ${Math.round(signalMetrics.estimatedPace)}bpm
            
            TASK: Evaluate teaching quality, clarity, and engagement. Specifically analyze how the disturbances (if any) impacted the flow relative to the emotions at that time.
            
            Output strictly this JSON:
            {
                "interaction_summary": "1-sentence summary.",
                "disturbance_conclusion": "Detailed conclusion about noise/disturbances and their impact on learning flow.",
                "metrics": {
                    "doubt_clarity_score": (1-10),
                    "explanation_quality_score": (1-10),
                    "interaction_understandability": (1-10)
                },
                "feedback": "Pedagogical critique."
            }
            `;

            const fetchFromModel = async (modelName) => {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${googleKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, audioPart] }] })
                });
                return response;
            };

            let response = await fetchFromModel("gemini-2.5-flash");
            if (!response.ok) {
                addLog("⚠️ 2.5 Failed. Retrying with Gemini 1.5 Flash...");
                response = await fetchFromModel("gemini-1.5-flash");
            }
            if (!response.ok) throw new Error("Cloud API Failed.");

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const aiAnalysis = JSON.parse(jsonStr);

            setResults({
                ai: aiAnalysis,
                signal: signalMetrics,
                timeline: serverTimeline || [], 
                disturbanceTimeline: disturbanceTimeline,
                rawDisturbances: localDisturbances
            });
            setStatus("success");
            addLog("✨ Analysis Complete.");

        } catch (err) {
            console.error(err);
            addLog(`❌ Error: ${err.message}`);
            setStatus("error");
        }
    };

    return (
        <div>
            {/* --- TOP SECTION (Navbar from First Code) --- */}
            <nav className="fixed top-0 left-0 w-full flex bg-black justify-between text-white z-20 shadow-lg">
                <div className="left flex flex-row items-center p-2 sm:p-0">
                    <img className="w-14 h-14 sm:w-16 sm:h-16 ms-4 mt-4 sm:ms-20 object-cover scale-180 origin-center" src={Logo2} alt="Logo" />
                    <div className="name mt-0 sm:mt-7 mx-2 sm:mx-5 text-base sm:text-lg font-medium">Parikshak AI</div>
                </div>

                {/* Desktop Navigation */}
                <div className="right hidden sm:flex flex-row justify-around items-center">
                    <span className="mx-6 cursor-pointer" onClick={() => handleNavigation("/")}>Home</span>
                    
                    {userRole === "Student/Admin" && (
                        <span onClick={() => handleNavigation("/insights")} className="mx-6 cursor-pointer">Insights</span>
                    )}
                    
                    <span onClick={() => handleNavigation('/textanalysis')} className="mx-6 cursor-pointer">Upload & Analyse</span>
                    <span onClick={() => handleNavigation("/live")} className="mx-6 cursor-pointer">Live Monitor</span>
                    <span onClick={() => handleNavigation("/audio")} className="mx-6 cursor-pointer">Audio Analysis</span>
                    
                    {userRole === "Student/Admin" ? (
                        <span onClick={() => handleNavigation("/feedback")} className="mx-6 cursor-pointer">Feedback</span>
                    ) : (
                        <span onClick={() => handleNavigation("/doubts")} className="mx-6 cursor-pointer">Doubts</span>
                    )}

                    {isUserLoggedIn ? (
                        <img
                            src={currentUser?.photoURL || "/fallback-avatar.png"}
                            alt="User Profile"
                            className="mx-10 w-10 h-10 rounded-full border border-white cursor-pointer"
                            onClick={() => handleNavigation("/profile")}
                        />
                    ) : (
                        <button className="mx-10 bg-[#24cfa6] h-9 w-28 rounded text-black font-medium" onClick={() => handleNavigation("/login")}>
                            Sign In
                        </button>
                    )}
                </div>

                {/* Mobile Menu Button */}
                <div className="flex items-center sm:hidden me-4">
                    {isUserLoggedIn ? (
                        <img src={currentUser?.photoURL || "/fallback-avatar.png"} alt="User Avatar" className="w-8 h-8 rounded-full border border-white me-4 cursor-pointer" onClick={() => handleNavigation("/profile")} />
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
                <div className="flex flex-col items-center py-4 space-y-3 text-white">
                    <span onClick={() => handleNavigation("/")} className="w-full text-center py-2 hover:bg-[#24cfa6]/20 cursor-pointer text-lg">Home</span>
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

            {/* --- MAIN CONTENT (From Second Code) --- */}
            <div className="min-h-screen pt-28 pb-12 px-6 md:px-12 flex flex-col items-center bg-black font-sans text-slate-900">
                <div className="max-w-6xl w-full space-y-8">
                    
                    {/* Header */}
                    <div className="text-center space-y-3">
                        <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-full mb-2">
                            <GraduationCap className="w-8 h-8 text-indigo-600" />
                        </div>
                        <h1 className="text-4xl font-bold text-white tracking-tight">
                            Classroom Interaction Analyst
                        </h1>
                        <p className="text-slate-500 max-w-xl mx-auto">
                            Powered by <strong>Audeering Wav2Vec2 (Colab)</strong>, <strong>AST Noise Detection</strong>, and <strong>Gemini 2.5</strong>.
                        </p>
                    </div>

                    
                    {/* File Upload */}
                    <div className={`
                        relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 group
                        ${file ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-400 hover:bg-white'}
                    `}>
                        <input 
                            type="file" 
                            accept="audio/*,video/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center justify-center text-center pointer-events-none">
                            {file ? (
                                <>
                                    <FileAudio className="w-16 h-16 text-indigo-600 mb-4 animate-bounce" />
                                    <p className="text-lg font-medium text-slate-700">{file.name}</p>
                                    <p className="text-sm text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    <audio src={audioUrl} controls className="mt-4 w-64 h-8 pointer-events-auto" />
                                </>
                            ) : (
                                <>
                                    <Upload className="w-16 h-16 text-slate-300 mb-4 group-hover:text-indigo-400 transition-colors" />
                                    <p className="text-lg font-medium text-slate-600">Drop audio recording here</p>
                                    <p className="text-sm text-slate-400 mt-1">Supports MP3, WAV, M4A</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="flex justify-center flex-col items-center gap-2">
                        <button
                            onClick={runAnalysis}
                            disabled={!file || status === 'processing'}
                            className={`
                                flex items-center gap-2 px-8 py-4 rounded-full font-bold text-lg shadow-lg transition-all transform hover:scale-105
                                ${status === 'processing' 
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/30'}
                            `}
                        >
                            {status === 'processing' ? (
                                <><Activity className="animate-spin" /> {downloadProgress ? `Downloading AST (${downloadProgress}%)` : 'Analyzing (Ngrok + Cloud)...'}</>
                            ) : (
                                <><Zap className="fill-current text-yellow-300" /> Analyze Recording</>
                            )}
                        </button>
                        {downloadProgress !== null && (
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                <Download className="w-3 h-3" />
                                Downloading offline noise model...
                            </div>
                        )}
                    </div>

                    {/* Logs Area */}
                    {(status === 'processing' || logs.length > 0) && (
                        <div className="bg-slate-900 text-green-400 font-mono text-sm p-4 rounded-xl overflow-hidden shadow-inner max-h-40 overflow-y-auto">
                            {logs.map((log, i) => (
                                <div key={i} className="mb-1 opacity-90 border-l-2 border-green-500 pl-2">{log}</div>
                            ))}
                            {status === 'processing' && <div className="animate-pulse pl-2">{'>'} ...</div>}
                        </div>
                    )}

                    {/* Results Dashboard */}
                    {results && status === 'success' && (
                        <div className="animate-fade-in space-y-8 pb-12">
                            
                            {/* SECTION 1: SIGNAL DASHBOARD */}
                            <div className="bg-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-xl">
                                <h3 className="text-xl font-bold flex items-center gap-3 mb-6">
                                    <Waves className="text-blue-400" />
                                    Audio Signal Profile
                                    <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-1 rounded-md">Local Metrics</span>
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">Avg Pitch</span>
                                            <Mic2 className="w-4 h-4 text-purple-400" />
                                        </div>
                                        <div className="text-3xl font-mono font-bold text-purple-200">
                                            {Math.round(results.signal.avgPitch)} <span className="text-sm text-purple-400">Hz</span>
                                        </div>
                                    </div>

                                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">Est. Pace</span>
                                            <Gauge className="w-4 h-4 text-cyan-400" />
                                        </div>
                                        <div className="text-3xl font-mono font-bold text-cyan-200">
                                            {Math.round(results.signal.estimatedPace)} <span className="text-sm text-cyan-400">bpm</span>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-orange-900 to-orange-800 p-4 rounded-xl border border-orange-700">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-orange-300 text-xs uppercase font-bold tracking-wider">Disturbances</span>
                                            <AlertTriangle className="w-4 h-4 text-orange-400" />
                                        </div>
                                        <div className="text-2xl font-bold text-orange-100">
                                            {results.rawDisturbances.length} <span className="text-sm text-orange-400">events</span>
                                        </div>
                                        <div className="text-xs text-orange-300 mt-1">
                                            Raw AST Detections
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: EMOTION TIMELINE (From Ngrok) */}
                            <div className="bg-slate-800 p-8 rounded-3xl border border-slate-200 shadow-lg">
                                <h3 className="text-xl font-bold flex items-center gap-3 mb-6 text-white">
                                    <Heart className="text-pink-500" />
                                    Emotional Timeline (30s Segments)
                                    <span className="text-xs font-normal text-white bg-pink-500 px-2 py-1 rounded-md">Via Colab</span>
                                </h3>
                                
                                {results.timeline && results.timeline.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {results.timeline.map((seg, idx) => (
                                            <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all hover:shadow-md hover:border-pink-200">
                                                <div className="text-xs font-mono font-bold text-slate-400 mb-2 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatTime(seg.start)} - {formatTime(seg.end)}
                                                </div>
                                                <div className={`text-lg font-bold capitalize mb-1 ${
                                                    seg.emotion.toLowerCase().includes('hap') ? 'text-green-600' : 
                                                    seg.emotion.toLowerCase().includes('ang') ? 'text-red-600' :
                                                    seg.emotion.toLowerCase().includes('sad') ? 'text-blue-600' : 'text-slate-600'
                                                }`}>
                                                    {seg.emotion}
                                                </div>
                                                <span className="text-[10px] text-slate-400 mt-1">Intensity: {Math.round(seg.confidence * 100)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-400 py-8 bg-slate-50 rounded-xl border-dashed border-2 border-slate-200">
                                        <div className="flex flex-col items-center gap-2">
                                            <Cpu className="w-8 h-8 text-slate-300" />
                                            <p>No timeline data received from server.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SECTION 3: DISTURBANCE TIMELINE (New Feature) */}
                            <div className="bg-slate-800 p-8 rounded-3xl border border-slate-200 shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5">
                                    <Volume2 className="w-64 h-64 text-slate-900" />
                                </div>
                                <h3 className="text-xl font-bold flex items-center gap-3 mb-6 text-white relative z-10">
                                    <Volume2 className="text-orange-600" />
                                    Disturbance Timeline (30s Segments)
                                    <span className="text-xs font-normal text-white bg-orange-600 px-2 py-1 rounded-md">Server + Local AST</span>
                                </h3>

                                {results.disturbanceTimeline && results.disturbanceTimeline.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                                        {results.disturbanceTimeline.map((seg, idx) => (
                                            <div key={idx} className={`
                                                rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all border-l-4
                                                ${seg.hasDisturbance 
                                                    ? 'bg-orange-50 border-orange-400 shadow-sm' 
                                                    : 'bg-white border-green-300 opacity-70'}
                                            `}>
                                                <div className="text-xs font-mono font-bold text-slate-400 mb-2 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatTime(seg.start)} - {formatTime(seg.end)}
                                                </div>
                                                
                                                {seg.hasDisturbance ? (
                                                    <>
                                                        <div className="flex flex-wrap justify-center gap-1 mb-1">
                                                            {seg.events.slice(0, 2).map((evt, i) => (
                                                                <span key={i} className="text-[10px] font-bold uppercase bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">
                                                                    {evt}
                                                                </span>
                                                            ))}
                                                            {seg.events.length > 2 && (
                                                                <span className="text-[10px] text-orange-600">+{seg.events.length - 2} more</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-orange-400 mt-1">Disturbed</div>
                                                    </>
                                                ) : (
                                                    <div className="text-sm font-medium text-green-600 flex items-center gap-1">
                                                        <CheckCircle2 className="w-4 h-4" /> Clean
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-slate-400 italic">No disturbance data available.</p>
                                )}
                            </div>

                            {/* SECTION 4: AI ANALYSIS & CRITIQUE */}
                            <div className="bg-amber-50 p-8 rounded-3xl border border-amber-200 shadow-sm">
                                <h3 className="text-xl font-bold flex items-center gap-3 mb-4 text-amber-800">
                                    <AlertTriangle className="text-amber-600" />
                                    Disturbance Analysis Conclusion
                                </h3>
                                <div className="space-y-4 text-amber-900">
                                    <p className="font-medium leading-relaxed">{results.ai.disturbance_conclusion}</p>
                                </div>
                            </div>

                            {/* SECTION 5: JUDGEMENT CRITERIA */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <ScoreCard 
                                    title="Understandability" 
                                    score={results.ai.metrics.interaction_understandability}
                                    icon={<BrainCircuit className="text-emerald-500" />}
                                    color="text-emerald-600"
                                    sub="Doubt Resolution Score"
                                />
                                <ScoreCard 
                                    title="Explanation Quality" 
                                    score={results.ai.metrics.explanation_quality_score}
                                    icon={<BookOpen className="text-blue-500" />}
                                    color="text-blue-600"
                                    sub="Teacher Clarity"
                                />
                                <ScoreCard 
                                    title="Doubt Clarity" 
                                    score={results.ai.metrics.doubt_clarity_score}
                                    icon={<HelpCircle className="text-amber-500" />}
                                    color="text-amber-600"
                                    sub="Student Articulation"
                                />
                            </div>

                            {/* SECTION 6: FINAL FEEDBACK */}
                            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-200 shadow-sm">
                                 <div className="flex items-start gap-4 mb-6">
                                    <div className="p-3 bg-indigo-50 rounded-lg">
                                        <MessageCircle className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Final Pedagogy Judgement</h3>
                                        <p className="text-slate-500 text-sm mt-1">AI assessment of the teaching strategy</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-50 rounded-lg border-l-4 border-slate-300">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Interaction Summary</span>
                                        <p className="text-slate-700 italic">{results.ai.interaction_summary}</p>
                                    </div>
                                    <div className="p-4 bg-indigo-50 rounded-lg border-l-4 border-indigo-400">
                                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block mb-1">Critique</span>
                                        <p className="text-indigo-900">{results.ai.feedback}</p>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function ScoreCard({ title, score, icon, color, sub }) {
    const getScoreColor = (s) => {
        if (s >= 8) return "text-emerald-600";
        if (s >= 5) return "text-amber-600";
        return "text-red-600";
    };

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center transform transition-all hover:-translate-y-1 hover:shadow-md">
            <div className="mb-3 bg-slate-50 p-3 rounded-full">{icon}</div>
            <h4 className="text-slate-500 font-medium text-sm uppercase tracking-wider">{title}</h4>
            <div className={`text-5xl font-bold my-2 ${getScoreColor(score)}`}>
                {score}<span className="text-2xl text-slate-300">/10</span>
            </div>
            <p className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{sub}</p>
        </div>
    );
}

export default Audio;