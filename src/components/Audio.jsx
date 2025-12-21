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
    Waves, MoveRight, Mic2, Cpu, PartyPopper, Users2, Clock, Server, Download, Key
} from 'lucide-react';

// --- CONSTANTS & CONFIG (From Logic Source) ---
const DEFAULT_GOOGLE_KEY = import.meta.env.VITE_EXTERNAL_API_KEY;
const DEFAULT_HF_KEY = "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";

const Audio = ({ userRole }) => {
    // --- NAVIGATION STATE (From Shell Source) ---
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const firebase = useFirebase();
    const navigate = useNavigate();
    const { isUserLoggedIn, currentUser, loginWithGoogle } = useFirebase();

    // --- ANALYSIS STATE (From Logic Source) ---
    const [googleKey, setGoogleKey] = useState(DEFAULT_GOOGLE_KEY);
    const [hfKey, setHfKey] = useState(DEFAULT_HF_KEY);
    
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState("idle"); 
    const [logs, setLogs] = useState([]);
    const [results, setResults] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [modelUsed, setModelUsed] = useState("Advanced LLM");
    const [downloadProgress, setDownloadProgress] = useState(null);
    
    // Libs loaded dynamically
    const [Pitchfinder, setPitchfinder] = useState(null);
    const [Yamnet, setYamnet] = useState(null); 

    // --- EFFECTS & LOGIC (From Logic Source) ---

    useEffect(() => {
        const loadLibs = async () => {
            try {
                // 1. Load Pitchfinder (Signal)
                const pfModule = await import('https://esm.sh/pitchfinder@2.3.0');
                setPitchfinder(pfModule);

                // 2. Load TensorFlow.js & YAMNet (Atmosphere)
                addLog("⏳ Loading YAMNet (Atmosphere)...");
                await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js');
                const yamnetModule = await import('https://cdn.jsdelivr.net/npm/@tensorflow-models/yamnet@0.8.0/+esm');
                const loadedYamnet = await yamnetModule.load();
                setYamnet(loadedYamnet);
                
                addLog("✅ Local Signal & Atmosphere Engines Ready");
            } catch (e) {
                console.error("Failed to load libraries:", e);
                addLog("⚠️ Warning: Local libraries failed. Analyzing with Cloud AI only.");
            }
        };
        loadLibs();
    }, []);

    const addLog = (msg) => setLogs(prev => [...prev, msg]);

    const handleNavigation = (path) => {
        navigate(path);
        if (isMenuOpen) setIsMenuOpen(false);
    };

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

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

    // --- AUDIO PROCESSING HELPERS ---

    const resampleBuffer = async (audioBuffer, targetSampleRate = 16000) => {
        if (audioBuffer.sampleRate === targetSampleRate) {
            return audioBuffer;
        }
        const offlineCtx = new OfflineAudioContext(
            1, audioBuffer.duration * targetSampleRate, targetSampleRate
        );
        const bufferSource = offlineCtx.createBufferSource();
        bufferSource.buffer = audioBuffer;
        bufferSource.connect(offlineCtx.destination);
        bufferSource.start();
        return await offlineCtx.startRendering();
    };

    const bufferToWav = (abuffer, len) => {
        const numOfChan = abuffer.numberOfChannels;
        const length = len * numOfChan * 2 + 44;
        const buffer = new ArrayBuffer(length);
        const view = new DataView(buffer);
        const channels = [];
        let i, sample, offset = 0, pos = 0;

        function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
        function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); 
        setUint32(0x45564157); // "WAVE"
        setUint32(0x20746d66); // "fmt "
        setUint32(16); 
        setUint16(1); 
        setUint16(numOfChan);
        setUint32(abuffer.sampleRate);
        setUint32(abuffer.sampleRate * 2 * numOfChan); 
        setUint16(numOfChan * 2); 
        setUint16(16); 
        setUint32(0x61746164); // "data"
        setUint32(length - pos - 4); 

        for (i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));

        while (pos < length) {
            for (i = 0; i < numOfChan; i++) {
                sample = Math.max(-1, Math.min(1, channels[i][offset])); 
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; 
                view.setInt16(pos, sample, true); 
                pos += 2;
            }
            offset++; 
        }
        return new Blob([buffer], { type: "audio/wav" });
    };

    // --- SERVER & AI ANALYSIS FUNCTIONS ---

    const runServerTimelineAnalysis = async (audioBuffer) => {
        const duration = audioBuffer.duration;
        const segmentDuration = 30; 
        const timeline = [];
        const MODEL_ID = "Speechbrain/emotion-recognition-wav2vec2-IEMOCAP"; 
        const API_URL = `https://api-inference.huggingface.co/models/${MODEL_ID}`;
        
        addLog(`🌐 Connecting to HF Server: ${MODEL_ID}...`);
        addLog(`⏱️ Resampling to 16kHz & Uploading 30s chunks...`);

        const query = async (blob, retries = 5) => {
            try {
                const response = await fetch(API_URL, {
                    headers: { Authorization: `Bearer ${hfKey}` },
                    method: "POST",
                    body: blob,
                });
                
                if (response.status === 503) {
                     const result = await response.json();
                     if (retries > 0) {
                        const wait = result.estimated_time || 20;
                        addLog(`⏳ Server warming up... waiting ${Math.ceil(wait)}s`);
                        await new Promise(r => setTimeout(r, wait * 1000));
                        return query(blob, retries - 1);
                    }
                }
                if (!response.ok) throw new Error(`API Error: ${response.status}`);
                return await response.json();
            } catch (e) {
                return { error: e.message };
            }
        };

        const mapLabel = (l) => {
            const map = { 'neu': 'Neutral', 'ang': 'Angry', 'hap': 'Happy', 'sad': 'Sad' };
            return map[l] || l;
        };

        for (let startTime = 0; startTime < duration; startTime += segmentDuration) {
            const endTime = Math.min(startTime + segmentDuration, duration);
            if (endTime - startTime < 3) continue;

            const startSample = Math.floor(startTime * audioBuffer.sampleRate);
            const endSample = Math.floor(endTime * audioBuffer.sampleRate);
            const frameCount = endSample - startSample;
            
            const chunkBuffer = new AudioContext().createBuffer(
                audioBuffer.numberOfChannels, frameCount, audioBuffer.sampleRate
            );
            
            for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
                chunkBuffer.copyToChannel(
                    audioBuffer.getChannelData(ch).slice(startSample, endSample), ch
                );
            }

            const resampledChunk = await resampleBuffer(chunkBuffer, 16000);
            const blob = bufferToWav(resampledChunk, resampledChunk.length);
            const output = await query(blob);

            if (Array.isArray(output) && output.length > 0) {
                const predictions = Array.isArray(output[0]) ? output[0] : output;
                const sorted = predictions.sort((a, b) => b.score - a.score);
                const top = sorted[0]; 

                if (top && top.label) {
                    const readableLabel = mapLabel(top.label);
                    timeline.push({
                        start: startTime, end: endTime,
                        emotion: readableLabel, confidence: top.score
                    });
                    addLog(`✅ Segment ${formatTime(startTime)}-${formatTime(endTime)}: ${readableLabel} (${Math.round(top.score*100)}%)`);
                }
            } else {
                addLog(`⚠️ Segment ${formatTime(startTime)}: Server failed. (Using Fallback)`);
            }
            await new Promise(r => setTimeout(r, 250));
        }
        return timeline;
    };

    const runYamnetAnalysis = async (audioBuffer) => {
        if (!Yamnet) return null;
        try {
            const scores = await Yamnet.predict(audioBuffer.getChannelData(0));
            let maxApplause = 0;
            let maxCrowd = 0;
            const checkFrames = Math.min(scores.length, 60); 

            for (let i = 0; i < checkFrames; i++) {
                const frame = scores[i];
                if (frame[7]) maxApplause = Math.max(maxApplause, frame[7]);
                if (frame[9]) maxCrowd = Math.max(maxCrowd, frame[9]);
            }
            return {
                hasApplause: maxApplause > 0.1, 
                hasCrowdNoise: maxCrowd > 0.1,
                applauseScore: maxApplause
            };
        } catch (e) {
            return null;
        }
    };

    const calculateAudioFeatures = async (file) => {
        if (!Pitchfinder) return null;
        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const data = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        let sumSquares = 0;
        const detectPitch = Pitchfinder.YIN({ sampleRate });
        const pitches = [];
        const step = 8192;
        
        for (let i = 0; i < data.length; i += step) {
            const chunk = data.slice(i, i + 2048);
            if(chunk.length < 2048) break;
            let sum = 0;
            for(let s of chunk) sum += s*s;
            sumSquares += sum;
            const p = detectPitch(chunk);
            if(p && p>60 && p<500) pitches.push(p);
        }
        
        const avgRMS = Math.sqrt(sumSquares / (data.length / (step/2048))); 
        const avgPitch = pitches.length ? pitches.reduce((a,b)=>a+b,0)/pitches.length : 0;
        const estimatedPace = (pitches.length / (audioBuffer.duration / 60)) * 2; 

        return { avgRMS, avgPitch, estimatedPace, audioBuffer };
    };

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
            addLog("⚙️ Initializing Analysis Pipeline...");
            if (file.size > 20 * 1024 * 1024) throw new Error("File too large. Please keep under 20MB for this demo.");

            // 1. SIGNAL PROCESSING
            addLog("📊 Processing Signal Metrics (Local)...");
            const signalMetrics = await calculateAudioFeatures(file);
            const { audioBuffer } = signalMetrics;
            addLog(`✅ Signal: ${Math.round(signalMetrics.avgPitch)}Hz | ${Math.round(signalMetrics.estimatedPace)} bpm`);

            // 2. SERVER-SIDE EMOTION TIMELINE
            let emotionTimeline = await runServerTimelineAnalysis(audioBuffer);
            
            // 3. YAMNET ATMOSPHERE
            let yamnetResults = null;
            if (Yamnet) {
                addLog("🎉 Checking Atmosphere (YAMNet)...");
                yamnetResults = await runYamnetAnalysis(audioBuffer);
                if (yamnetResults?.hasApplause) addLog("👏 Applause Detected");
            }

            // 4. CLOUD ANALYSIS (LLM)
            addLog("📤 Uploading to LLM Engine...");
            const audioPart = await fileToGenerativePart(file);
            addLog("🤖 Analyzing Pedagogy & Fallback Emotion...");
            
            const timelineInstruction = (emotionTimeline && emotionTimeline.length > 0)
                ? "Review the uploaded audio for context." 
                : "SEGMENTED TIMELINE: Break the audio into 30-second segments. Determine emotion and confidence.";

            const prompt = `
            Analyze this classroom audio.
            ${timelineInstruction}
            2. PEDAGOGY: Analyze interaction quality.
            Output strictly this JSON structure:
            {
                "interaction_summary": "1-sentence summary.",
                "timeline": [
                    { "start": 0, "end": 30, "emotion": "Neutral", "confidence": 0.85 }
                ],
                "metrics": {
                    "doubt_clarity_score": (1-10),
                    "explanation_quality_score": (1-10),
                    "interaction_understandability": (1-10)
                },
                "feedback": "Critique."
            }
            Just JSON. No markdown.
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
            let usedModelName = "Advanced LLM";
            
            if (!response.ok) {
                addLog("⚠️ Retrying with Standard LLM...");
                response = await fetchFromModel("gemini-1.5-flash");
                usedModelName = "Standard LLM";
            }
            if (!response.ok) throw new Error("Cloud API Failed. Check Key.");

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const aiAnalysis = JSON.parse(jsonStr);

            const finalTimeline = (emotionTimeline && emotionTimeline.length > 0) ? emotionTimeline : aiAnalysis.timeline;
            const timelineSource = (emotionTimeline && emotionTimeline.length > 0) ? "SpeechBrain IEMOCAP (Server)" : `${usedModelName} (Fallback)`;

            addLog(`✅ Timeline Generated by ${timelineSource}`);

            setResults({
                ai: aiAnalysis,
                signal: signalMetrics,
                timeline: finalTimeline, 
                timelineSource,
                atmosphere: yamnetResults
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
            {/* --- TOP SECTION (Black Background + Navbar) --- */}
            <section className="w-full min-h-screen flex flex-col items-center bg-black text-white pt-24 relative overflow-x-hidden overflow-y-auto pb-20 overflow-y-scroll [&::-webkit-scrollbar]:hidden">
            
                {/* DECORATIVE BLURS */}
                <div className="absolute top-[-150px] right-[-150px] w-[350px] h-[350px] bg-[#24cfa6] rounded-full blur-[160px] opacity-40"></div>
                <div className="absolute bottom-[-150px] left-[-150px] w-[350px] h-[350px] bg-[#24cfa6] rounded-full blur-[160px] opacity-40 pointer-events-none"></div>

                {/* --- NAVIGATION --- */}
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
                                    <div className="flex flex-col items-center py-4 space-y-3">
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

                {/* --- MAIN ANALYSIS INTERFACE --- */}
                <div className="w-full max-w-6xl px-4 md:px-8 z-10 flex flex-col gap-8">
                    
                    {/* Header */}
                    <div className="text-center space-y-3 mt-3">
                        <h1 className="text-4xl font-bold text-white tracking-tight">
                            Classroom Interaction Analyst
                        </h1>
                        <p className="text-slate-300 max-w-xl mx-auto">
                            Robust analysis using <strong>SpeechBrain IEMOCAP</strong> (Server) and <strong>Advanced LLM</strong> (Pedagogy).
                        </p>
                    </div>

                    {/* API Key Inputs */}
                    {/*<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-sm p-4 rounded-xl flex items-center gap-4">
                            <Lock className="w-5 h-5 text-[#24cfa6]" />
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">LLM API Key (Google)</label>
                                <input 
                                    type="password" 
                                    value={googleKey}
                                    onChange={(e) => setGoogleKey(e.target.value)}
                                    className="w-full bg-transparent border-none focus:ring-0 text-white font-mono text-sm placeholder-slate-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-sm p-4 rounded-xl flex items-center gap-4">
                            <Server className="w-5 h-5 text-[#24cfa6]" />
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Hugging Face Token</label>
                                <input 
                                    type="password" 
                                    value={hfKey}
                                    onChange={(e) => setHfKey(e.target.value)}
                                    className="w-full bg-transparent border-none focus:ring-0 text-white font-mono text-sm placeholder-slate-500 outline-none"
                                    placeholder="hf_..."
                                />
                            </div>
                        </div>
                    </div>
*/}

                    {/* File Upload */}
                    <div className={`
                        relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 group
                        ${file ? 'border-[#24cfa6] bg-[#24cfa6]/10' : 'border-slate-600 hover:border-[#24cfa6] hover:bg-white/5'}
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
                                    <FileAudio className="w-16 h-16 text-[#24cfa6] mb-4" />
                                    <p className="text-lg font-medium text-white">{file.name}</p>
                                    <p className="text-sm text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                    <audio src={audioUrl} controls className="mt-4 w-64 h-8 pointer-events-auto" />
                                </>
                            ) : (
                                <>
                                    <Upload className="w-16 h-16 text-slate-500 mb-4 group-hover:text-[#24cfa6] transition-colors" />
                                    <p className="text-lg font-medium text-slate-300">Drop audio recording here</p>
                                    <p className="text-sm text-slate-500 mt-1">Supports MP3, WAV, M4A</p>
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
                                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                                    : 'bg-[#24cfa6] text-black hover:bg-[#1ea887] hover:shadow-[#24cfa6]/30'}
                            `}
                        >
                            {status === 'processing' ? (
                                <><Activity className="animate-spin" /> Analyzing (Cloud + Local)...</>
                            ) : (
                                <><Zap className="fill-current" /> Analyze Recording</>
                            )}
                        </button>
                    </div>

                    {/* Logs Area */}
                    {(status === 'processing' || logs.length > 0) && (
                        <div className="bg-slate-900 text-[#24cfa6] font-mono text-sm p-4 rounded-xl overflow-hidden shadow-inner max-h-40 overflow-y-auto border border-slate-700">
                            {logs.map((log, i) => (
                                <div key={i} className="mb-1 opacity-90 border-l-2 border-[#24cfa6] pl-2">{log}</div>
                            ))}
                            {status === 'processing' && <div className="animate-pulse pl-2">{'>'} ...</div>}
                        </div>
                    )}

                    {/* Results Dashboard */}
                    {results && status === 'success' && (
                        <div className="animate-fade-in space-y-8 pb-12">
                            
                            {/*<div className="flex justify-center">
                                <span className="inline-flex items-center gap-1 bg-[#24cfa6]/20 text-[#24cfa6] text-xs px-2 py-1 rounded-full font-semibold">
                                    <Zap className="w-3 h-3" /> Powered by {modelUsed}, YAMNet & SpeechBrain
                                </span>
                            </div>*/}

                            <div className="text-center space-y-3 mt-3">
                        <h1 className="text-3xl font-bold text-white tracking-tight mt-5 mb-5">
                            Audio Analysis
                        </h1>
                        </div>

                            {/* SECTION 1: SIGNAL DASHBOARD */}
                            <div className="bg-slate-900/80 backdrop-blur text-white p-6 md:p-8 rounded-3xl shadow-xl border border-slate-700">
                                <h3 className="text-xl font-bold flex items-center gap-3 mb-6">
                                    <Waves className="text-[#24cfa6]" />
                                    Audio Signal Profile
                                    <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-1 rounded-md">Local Metrics</span>
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Pitch */}
                                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-slate-400 text-xs uppercase font-bold">Avg. Pitch</span>
                                            <Mic2 className="w-4 h-4 text-[#24cfa6]" />
                                        </div>
                                        <div className="text-3xl font-bold">{Math.round(results.signal.avgPitch)} <span className="text-sm font-normal text-slate-500">Hz</span></div>
                                        <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                                            <div className="h-full bg-[#24cfa6]" style={{width: `${Math.min(100, results.signal.avgPitch/3)}%`}}></div>
                                        </div>
                                    </div>
                                    
                                    {/* Pace */}
                                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-slate-400 text-xs uppercase font-bold">Speaking Pace</span>
                                            <Clock className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <div className="text-3xl font-bold">{Math.round(results.signal.estimatedPace)} <span className="text-sm font-normal text-slate-500">bpm</span></div>
                                        <p className="text-xs text-slate-400 mt-1">Est. syllables per min</p>
                                    </div>

                                    {/* Atmosphere */}
                                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-slate-400 text-xs uppercase font-bold">Atmosphere</span>
                                            <Users2 className="w-4 h-4 text-purple-400" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <div className={`flex items-center gap-2 text-sm ${results.atmosphere?.hasApplause ? 'text-green-400' : 'text-slate-500'}`}>
                                                <PartyPopper className="w-4 h-4" /> {results.atmosphere?.hasApplause ? "Applause Detected" : "No Applause"}
                                            </div>
                                            <div className={`flex items-center gap-2 text-sm ${results.atmosphere?.hasCrowdNoise ? 'text-yellow-400' : 'text-slate-500'}`}>
                                                <Users className="w-4 h-4" /> {results.atmosphere?.hasCrowdNoise ? "Crowd Activity" : "Quiet Room"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: EMOTION TIMELINE */}
                            <div className="bg-slate-900/80 backdrop-blur text-white p-6 md:p-8 rounded-3xl shadow-xl border border-slate-700">
                                <h3 className="text-xl font-bold flex items-center gap-3 mb-6">
                                    <Activity className="text-pink-500" />
                                    Emotional Timeline
                                    <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-1 rounded-md">{results.timelineSource}</span>
                                </h3>

                                <div className="space-y-3">
                                    {results.timeline && results.timeline.map((seg, idx) => (
                                        <div key={idx} className="flex items-center gap-4 bg-slate-800 p-3 rounded-lg border border-slate-700 hover:border-slate-500 transition-colors">
                                            <div className="w-24 text-sm font-mono text-slate-400 text-right">
                                                {formatTime(seg.start)} - {formatTime(seg.end)}
                                            </div>
                                            <div className="flex-1 h-3 bg-slate-700 rounded-full overflow-hidden relative">
                                                <div 
                                                    className={`h-full absolute left-0 top-0 transition-all duration-500 ${
                                                        seg.emotion === 'Angry' ? 'bg-red-500' :
                                                        seg.emotion === 'Happy' ? 'bg-green-500' :
                                                        seg.emotion === 'Sad' ? 'bg-blue-500' : 'bg-slate-400'
                                                    }`}
                                                    style={{ width: `${Math.max(10, seg.confidence * 100)}%` }}
                                                ></div>
                                            </div>
                                            <div className="w-24 font-bold text-sm text-right flex items-center justify-end gap-2">
                                                {seg.emotion}
                                                {seg.emotion === 'Angry' && <AlertCircle className="w-4 h-4 text-red-500" />}
                                                {seg.emotion === 'Happy' && <Heart className="w-4 h-4 text-green-500" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* SECTION 3: PEDAGOGY AI */}
                            <div className="bg-slate-900/80 backdrop-blur text-white p-6 md:p-8 rounded-3xl shadow-xl border border-slate-700">
                                <h3 className="text-xl font-bold flex items-center gap-3 mb-6 text-white">
                                    <BrainCircuit className="text-green-400" />
                                    Pedagogical Insights
                                </h3>

                                <div className="mb-8 p-4 bg-slate-700 border-l-4 border-indigo-500 rounded-r-lg text-slate-400 italic">
                                    "{results.ai.interaction_summary}"
                                </div>

                                {/* Metrics */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                                    {Object.entries(results.ai.metrics).map(([key, score]) => (
                                        <div key={key} className="text-center">
                                            <div className="relative inline-flex items-center justify-center w-20 h-20 mb-3">
                                                <svg className="w-full h-full transform -rotate-90">
                                                    <circle cx="40" cy="40" r="36" className="text-slate-200" strokeWidth="6" fill="none" />
                                                    <circle 
                                                        cx="40" cy="40" r="36" 
                                                        className="text-green-400" 
                                                        strokeWidth="6" 
                                                        fill="none" 
                                                        strokeDasharray={226}
                                                        strokeDashoffset={226 - (226 * score / 10)}
                                                    />
                                                </svg>
                                                <span className="absolute text-2xl font-bold text-white">{score}</span>
                                            </div>
                                            <h4 className="text-sm font-semibold text-white uppercase tracking-wide">
                                                {key.replace(/_/g, ' ')}
                                            </h4>
                                        </div>
                                    ))}
                                </div>

                                {/* Feedback */}
                                <div className="bg-slate-700 p-6 rounded-2xl border border-slate-200">
                                    <h4 className="font-bold text-slate-400 mb-2 flex items-center gap-2">
                                        <MessageCircle className="w-4 h-4" /> Instructor Feedback
                                    </h4>
                                    <p className="text-slate-400 leading-relaxed">
                                        {results.ai.feedback}
                                    </p>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}

export default Audio