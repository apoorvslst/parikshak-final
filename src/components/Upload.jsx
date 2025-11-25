import React, { useState, useEffect } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { useFirebase, app } from "../context/Firebase"; // ensure `app` is exported
import { useNavigate } from "react-router-dom";
import * as Whisper from "whisper-wasm";
import axios from "axios";

const Upload = () => {
  const firebase = useFirebase();
  const firestore = getFirestore(app);
  const navigate = useNavigate();

  const [teachers, setTeachers] = useState([]);
  const [topic,setTopic]=useState('');

  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };
  const [refmat, setRefmat] = useState("");

  const handleTextFileChange = (e) => {
    const file = e.target.value;
    if (!file) return;

    setRefmat(file);
  };
  const [transcribedText,setTranscribedText]=useState('');

// const transcribeMedia = async (file) => {
//   if (!file) return;

//   try {
    
//   }
// };


useEffect(() => {
  if (file) {
    transcribeMedia(file).catch(err => {
      console.error("Transcription failed:", err);
    });
  }
}, [file]);

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const querySnapshot = await getDocs(collection(firestore, "teachers"));
        const teacherNames = querySnapshot.docs.map((doc) => doc.data().name);
        setTeachers(teacherNames);
        console.log("Fetched teachers:", teacherNames);
      } catch (err) {
        console.error("Error fetching teachers:", err);
      }
    };

    fetchTeachers();
  }, [firestore]);

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
            <img
              className="w-20 h-20 ms-20"
              src="https://cdn.creazilla.com/icons/3432265/teacher-icon-lg.png"
              alt=""
            />
            <div className="name mt-7 mx-5 text-lg font-medium">Parikshak AI</div>
          </div>

          <div className="right flex flex-row justify-around items-center">
            <span onClick={() => navigate("/")} className="mx-10 cursor-pointer">Home</span>
            <span className="mx-10 cursor-pointer">Insights</span>
            <span onClick={() => navigate("/textanalysis")} className="mx-10 cursor-pointer">Upload & Analyse</span>
            <span className="mx-10 cursor-pointer">Feedback</span>
            {firebase.isUserLoggedIn && firebase.currentUser ? (
              <img
                src={firebase.currentUser.photoURL || "/fallback-avatar.png"}
                alt="User"
                className="mx-10 w-10 h-10 rounded-full border border-white"
              />
            ) : (
              <button
                className="mx-10 bg-[#24cfa6] h-9 w-28 rounded"
                onClick={() => navigate("/login")}
              >
                Sign In
              </button>
            )}
          </div>
        </nav>

        <div className="instructions flex justify-around items-start w-160 mt-10 gap-4 text-white">
  <div className="step flex flex-col items-center bg-gray-900 rounded-lg p-4 shadow-md w-48 text-center">
    <div className="step-number w-10 h-10 flex items-center justify-center bg-[#24cfa6] rounded-full text-black font-bold mb-2">
      1
    </div>
    <span className="font-semibold text-md">Select teacher and topic</span>
    <p className="text-gray-400 mt-1 text-sm">Choose the teacher and topic</p>
  </div>

  <div className="step flex flex-col items-center bg-gray-900 rounded-lg p-4 shadow-md w-48 text-center">
    <div className="step-number w-10 h-10 flex items-center justify-center bg-[#24cfa6] rounded-full text-black font-bold mb-2">
      2
    </div>
    <span className="font-semibold text-md">Upload audio/video recording</span>
    <p className="text-gray-400 mt-1 text-sm">Provide your recording for analysis</p>
  </div>

  <div className="step flex flex-col items-center bg-gray-900 rounded-lg p-4 shadow-md w-48 text-center">
    <div className="step-number w-10 h-10 flex items-center justify-center bg-[#24cfa6] rounded-full text-black font-bold mb-2">
      3
    </div>
    <span className="font-semibold text-md">Add Reference Material</span>
    <p className="text-gray-400 mt-1 text-sm">Attach any supplementary material</p>
  </div>
</div>
        <label htmlFor="teacher" className="block mb-2 font-medium mt-6">
          Select Teacher
        </label>
        <input
          list="teachers"
          name="teacher"
          id="teacher"
          className="border p-2 rounded text-white w-72"
          placeholder="Start typing a name..."
        />
        <datalist id="teachers">
          {teachers.map((name, index) => (
            <option key={index} value={name} />
          ))}
        </datalist>
        <label htmlFor="topic" className="block mb-2 font-medium mt-4">
          Give Topic
        </label>
        <input type="text" onChange={(e)=>setTopic(e.target.value)} placeholder="Start typing any topic..." id="topic" className="border p-2 rounded text-white w-72" />
        <div className="w-full max-w-2xl flex flex-col gap-4 mt-4 md:flex-row md:justify-between pt-6">
  <div className="flex flex-col w-full md:w-1/2">
    <label className="mb-1 font-medium">Audio/Video Input</label>
    <input
      type="file"
      accept="audio/*,video/*"
      className="border p-2 rounded text-white w-full h-20"
      onChange={handleFileChange}
    />
  </div>

  <div className="flex flex-col w-full md:w-1/2">
    <textarea name="referencemat" placeholder="Give Reference Material" id="" onChange={handleTextFileChange} className="border p-2 rounded text-white w-full h-20 mt-7"></textarea>
  </div>
</div>
<button className="text-white bg-[#24cfa6] h-10 w-30 rounded mt-8 mb-8">Evaluate</button>
<div>
  <p>
    TranscribedText : {transcribedText}
  </p>
</div>
      </section>
    </div>
  );
};

export default Upload;
