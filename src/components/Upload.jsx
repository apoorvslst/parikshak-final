import React, { useState, useEffect, useRef } from "react";
// 🌟 NEW IMPORTS for Firestore operations
import { 
    getFirestore, 
    collection, 
    getDocs,
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    arrayUnion // Crucial for safely appending to arrays
} from "firebase/firestore";
import { useFirebase, app } from "../context/Firebase"; 
import { useNavigate } from "react-router-dom";

// 1. WORKER CODE STRING (Fixed: Sanitizes data before postMessage)
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
            // A. Load Model with Sanitized Progress Callback
            const transcriber = await PipelineSingleton.getInstance((data) => {
                // ERROR FIX: Do NOT send the whole 'data' object. It causes cloning errors.
                // Only send the primitive values we need.
                self.postMessage({ 
                    status: 'loading', 
                    data: { 
                        status: data.status, 
                        progress: data.progress || 0,
                        file: data.file 
                    } 
                });
            });
            
            // B. Run Transcription with Sanitized Partial Callback
            const output = await transcriber(audio, {
                chunk_length_s: 30,
                stride_length_s: 5,
                callback_function: (item) => {
                    // ERROR FIX: 'item' might contain complex internal references.
                    // Only extract the text string.
                    const text = typeof item === 'string' ? item : item.text;
                    self.postMessage({ status: 'partial', text: text });
                }
            });

            // C. Send Final Result
            self.postMessage({ status: 'complete', text: output.text });

        } catch (err) {
            self.postMessage({ status: 'error', error: err.message });
        }
    }
});
`;

const Upload = () => {
  const firebase = useFirebase();
  const firestore = getFirestore(app);
  const navigate = useNavigate();

  const [teachers, setTeachers] = useState([]);
  const [subject, setSubject] = useState('');
  const [file, setFile] = useState(null);
  const [refmat, setRefmat] = useState("");
  const [transcribedText, setTranscribedText] = useState('');
  const [teachername,setTeachername] = useState('');

  // NEW: Gemini result + loading flags
  const [mystate,setMystate] = useState('1');
  const [geminiResult, setGeminiResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);


  const workerRef = useRef(null);

  // 2. INITIALIZE WORKER
  useEffect(() => {
    // Create worker from the string constant
    const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    workerRef.current = new Worker(workerUrl, { type: 'module' });

    // Listen for messages from worker
    workerRef.current.onmessage = (e) => {
      const { status, text, data, error } = e.data;

      if (status === 'loading') {
          // Handle downloading progress
          if (data && data.status === 'progress') {
              setTranscribedText(`Downloading AI Model: ${Math.round(data.progress)}%`);
          } else {
              setTranscribedText("Initializing AI...");
          }
      } 
      else if (status === 'partial') {
          // optional live partials (left commented)
          // setTranscribedText((prev) => prev + text);
      } 
      else if (status === 'complete') {
          // Transcription finished -> unset uploading
          setIsUploading(false);
          setTranscribedText(text);
      } 
      else if (status === 'error') {
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

  // When file selected: display "Uploading..." and start transcription
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      // show immediate uploading UI
      setIsUploading(true);
      setTranscribedText("Uploading...");
    }
  };

  const handleTextFileChange = (e) => {
    const file = e.target.value;
    if (file) setRefmat(file);
  };

  const transcribeMedia = async (fileToTranscribe) => {
    if (!fileToTranscribe || !workerRef.current) return;

    try {
      // show decoding progress / message
      setTranscribedText("Reading and decoding audio (Main Thread)...");
      // A. Setup Audio Context (Must be 16kHz for Whisper)
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext({ sampleRate: 16000 });

      // B. Read file bytes
      const arrayBuffer = await fileToTranscribe.arrayBuffer();

      // C. Decode audio
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // D. Get raw audio data (Mono channel)
      const audioData = audioBuffer.getChannelData(0);

      setTranscribedText("Audio decoded. Sending to background AI worker...");

      // E. Send raw data to worker (worker will set isUploading false on complete)
      workerRef.current.postMessage({ 
          type: 'transcribe', 
          audio: audioData 
      });

    } catch (err) {
      console.error(err);
      setIsUploading(false);
      setTranscribedText("Failed to decode audio: " + err.message);
    }
  };

  // Auto-start transcription when file changes
  useEffect(() => {
    if (file) {
      // transcribeMedia will update transcribedText and clear isUploading after completion
      transcribeMedia(file).catch(err => {
        console.error("Transcription failed:", err);
        setIsUploading(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const querySnapshot = await getDocs(collection(firestore, "teachers"));
        const teacherNames = querySnapshot.docs.map((doc) => doc.data().name);
        setTeachers(teacherNames);
      } catch (err) {
        console.error("Error fetching teachers:", err);
      }
    };

    fetchTeachers();
  }, [firestore]);

  // ----------------- GEMINI EVALUATION (MODIFIED) -----------------
  const GEMINI_API_KEY = process.env.REACT_APP_EXTERNAL_API_KEY;

  const handleGeminiEvaluate = async () => {
    try {
      // require transcription to exist
      if (!transcribedText || transcribedText.trim().length === 0) {
        alert("Please upload audio first so transcription can occur.");
        return;
      }

      // require reference material
      if (!refmat || refmat.trim().length === 0) {
        alert("Please paste reference material before evaluating.");
        return;
      }
      if(!subject){
        alert("Please add sunject");
        return;
      }
      // Require teacher name for Firestore update
      if(!teachername || teachername.trim().length === 0) {
          alert("Please select or enter a teacher name.");
          return;
      }
      // Get the current user's email for the profile creation (assuming the logged-in user is the teacher or creator)
      const currentUserEmail = firebase.currentUser?.email || "unknown@example.com";

      // set evaluation loading state and show message in UI
      setIsEvaluating(true);
      setTranscribedText("Evaluating with Gemini...");

      // system prompt and user prompt (strict JSON output requested)
      const systemPrompt = `
You are an evaluator AI.
Compare the transcript with the reference text.
Return ONLY strict JSON with the following schema:
{
  "subject": "Inferred Subject(in around 1-3 words only)",
  "overall_rating": (Float between 0-5),
  "total_evaluations": (Integer),
  "improvement_percentage": (Integer),
  "metrics": {
    "clarity_score": (Integer 0-100),
    "example_quality": (Integer 0-100),
    "doubt_resolution": (Integer 0-100),
    "voice_sentiment": (Integer 0-100),
    "syllabus_completion": (Integer 0-100),
    "content_simplification": (Integer 0-100),
    "student_engagement": (Integer 0-100)

}
`;

      const userPrompt = `
TRANSCRIBED TEXT:
${transcribedText}

REFERENCE MATERIAL:
${refmat}

Evaluate and return ONLY JSON (no extra text).
`;

      // call Gemini endpoint (v1beta generateContent). Replace model name if necessary.
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          // Using the shape the API expects (contents + systemInstruction)
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!resp.ok) {
        // read body to give better debugging info
        const errText = await resp.text();
        throw new Error(`Gemini API error ${resp.status}: ${errText}`);
      }

      const result = await resp.json();

      // Extract returned text from response structure (candidates -> content -> parts)
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      // Try parse JSON strictly; fallback to extracting JSON substring if model added noise
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        // attempt to find first JSON object in returned text
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error("Could not parse JSON from Gemini response");
        }
      }

      // store gemini result and show it inside the same transcribedText box
      setGeminiResult(parsed);

      setTranscribedText(JSON.stringify(parsed, null, 2));
      console.log(parsed); // Changed to 'parsed' since 'geminiResult' is async
      setMystate('2');

      // -----------------------------------------------------------------
      // 🌟 NEW: FIRESTORE TEACHER UPDATE LOGIC 🌟
      // -----------------------------------------------------------------
      
      const teacherRef = doc(firestore, "teachers", teachername); // Use teachername as the document ID
      const teacherSnap = await getDoc(teacherRef);
      
      const newRating = parsed.overall_rating;
      const newTopic = parsed.subject;
      
      if (teacherSnap.exists()) {
          // Teacher EXISTS: Update their existing document
          console.log("Teacher exists. Appending rating and topic...");
          
          await updateDoc(teacherRef, {
              rating: arrayUnion(newRating), // Always append the new rating
              topics: arrayUnion(newTopic)    // Only append topic if it doesn't already exist
          });

          console.log("Teacher profile updated successfully.");
          
      } else {
          // Teacher DOES NOT exist: Create a new document
          console.log("Teacher does not exist. Creating new profile...");
          
          await setDoc(teacherRef, {
              name: teachername,
              rating: [newRating],
              topics: [newTopic]
          });

          console.log("New teacher profile created successfully.");
      }
      // -----------------------------------------------------------------

    } catch (err) {
      console.error("Gemini error:", err);
      setTranscribedText("Gemini evaluation failed. See console for details.");
      alert("Gemini evaluation failed. Check console for details.");
    } finally {
      setIsEvaluating(false);
    }
  };

  // -----------------------------------------------------

  return (
    <div>
      <section className="w-full flex flex-col items-center justify-around bg-black text-white text-center pt-20 relative overflow-hidden">
        
        {/* TOP-RIGHT PATCH */}
        <div className="absolute top-[-150px] right-[-150px] w-[350px] h-[350px] bg-[#24cfa6] rounded-full blur-[160px] opacity-40"></div>

        {/* BOTTOM-LEFT PATCH */}
        <div className="absolute bottom-[-150px] left-[-150px] w-[350px] h-[350px] bg-[#24cfa6] rounded-full blur-[160px] opacity-40"></div>

        {/* NAVBAR */}
        <nav className="fixed top-0 left-0 w-full flex flex-row bg-transparent justify-between text-white">
          <div className="left flex flex-row">
            <img className="w-20 h-20 ms-20" src="https://cdn.creazilla.com/icons/3432265/teacher-icon-lg.png" alt="" />
            <div className="name mt-7 mx-5 text-lg font-medium">Parikshak AI</div>
          </div>

          <div className="right flex flex-row justify-around items-center">
            <span onClick={()=>navigate('/')} className="mx-10 cursor-pointer">Home</span>
            <span onClick={()=>navigate("/insights")} className="mx-10 cursor-pointer">Insights</span>
            <span className="mx-10 cursor-pointer">Upload & Analyse</span>
            <span onClick={() => navigate("/live")} className="mx-10 cursor-pointer">Live Monitor</span>
            <span onClick={() => navigate("/feedback")} className="mx-10 cursor-pointer">Feedback</span>
            {firebase.isUserLoggedIn && firebase.currentUser ? (
              <img src={firebase.currentUser.photoURL || "/fallback-avatar.png"} alt="User" className="mx-10 w-10 h-10 rounded-full border border-white" />
            ) : (
              <button className="mx-10 bg-[#24cfa6] h-9 w-28 rounded" onClick={() => navigate("/login")}>Sign In</button>
            )}
          </div>
        </nav>

        {/* INSTRUCTIONS */}
        <div className="instructions flex justify-around items-start w-160 mt-10 gap-4 text-white">
          <div className="step flex flex-col items-center bg-gray-900 rounded-lg p-4 shadow-md w-48 text-center">
            <div className="step-number w-10 h-10 flex items-center justify-center bg-[#24cfa6] rounded-full text-black font-bold mb-2">1</div>
            <span className="font-semibold text-md">Select teacher and topic</span>
            <p className="text-gray-400 mt-1 text-sm">Choose the teacher and topic</p>
          </div>

          <div className="step flex flex-col items-center bg-gray-900 rounded-lg p-4 shadow-md w-48 text-center">
            <div className="step-number w-10 h-10 flex items-center justify-center bg-[#24cfa6] rounded-full text-black font-bold mb-2">2</div>
            <span className="font-semibold text-md">Upload audio/video recording</span>
            <p className="text-gray-400 mt-1 text-sm">Provide your recording for analysis</p>
          </div>

          <div className="step flex flex-col items-center bg-gray-900 rounded-lg p-4 shadow-md w-48 text-center">
            <div className="step-number w-10 h-10 flex items-center justify-center bg-[#24cfa6] rounded-full text-black font-bold mb-2">3</div>
            <span className="font-semibold text-md">Add Reference Material</span>
            <p className="text-gray-400 mt-1 text-sm">Attach any supplementary material</p>
          </div>
        </div>

        {/* FORM INPUTS */}
        <label htmlFor="teacher" className="block mb-2 font-medium mt-6">Select Teacher</label>
        <input list="teachers" onChange={(e)=>setTeachername(e.target.value)} name="teacher" id="teacher" className="border p-2 rounded text-white w-72" placeholder="Start typing a name..." />
        <datalist id="teachers">
          {teachers.map((name, index) => (
            <option key={index} value={name} />
          ))}
        </datalist>

        <label htmlFor="subject" className="block mb-2 font-medium mt-4">Give Subject</label>
        <input type="text" onChange={(e)=>setSubject(e.target.value)} placeholder="Start typing any subject..." id="subject" className="border p-2 rounded text-white w-72 bg-black" />
        
        <div className="w-full max-w-2xl flex flex-col gap-4 mt-4 md:flex-row md:justify-between pt-6">
          <div className="flex flex-col w-full md:w-1/2">
            <label className="mb-1 font-medium">Audio/Video Input</label>
            <input type="file" accept="audio/*,video/*" className="border p-2 rounded text-white w-full h-20" onChange={handleFileChange} />
          </div>

          <div className="flex flex-col w-full md:w-1/2">
            <textarea name="referencemat" placeholder="Give Reference Material" id="" onChange={handleTextFileChange} className="border p-2 rounded text-white w-full h-20 mt-7"></textarea>
          </div>
        </div>

        {/* Evaluate button now triggers Gemini evaluation (preserves UI) */}
        <button
          onClick={handleGeminiEvaluate}
          className="text-white bg-[#24cfa6] h-10 w-30 rounded mt-8 mb-8"
          disabled={isUploading || isEvaluating}
        >
          {isUploading ? "Uploading..." : isEvaluating ? "Evaluating..." : "Evaluate"}
        </button>
        
        <div className="w-full max-w-2xl p-4 border border-gray-700 rounded mb-10 bg-gray-900">
          <p className="text-gray-300 font-bold mb-2">{mystate === '1' ? "Transcription :" : "Evaluation :"}</p>
          <p className="text-gray-400 whitespace-pre-wrap h-64 overflow-y-auto">
            {transcribedText}
          </p>
        </div>

      </section>
    </div>
  );
};

export default Upload;