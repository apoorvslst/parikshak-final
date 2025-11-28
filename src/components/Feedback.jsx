import React, { useState } from "react";
import { useFirebase } from "../context/Firebase";
import { useNavigate } from "react-router-dom";

// Dummy Teacher Data
const teacherData = [
  { name: "Mr. ABC", subject: "Mathematics", count: 45, rating: "4.5/5", authenticity: 85, bias: 15 },
  { name: "Mr. ABX", subject: "Physics", count: 32, rating: "3.5/5", authenticity: 85, bias: 15 },
  { name: "Mr. Don", subject: "Chemistry", count: 58, rating: "5/5", authenticity: 88, bias: 12 },
  { name: "Ms. Arti", subject: "Biology", count: 38, rating: "4/5", authenticity: 90, bias: 10 },
  { name: "Mrs. Jaya", subject: "English", count: 28, rating: "3.5/5", authenticity: 95, bias: 5 },
  { name: "Mr. Kishore", subject: "History", count: 45, rating: "4.3/5", authenticity: 85, bias: 15 },
];

const Feedback = () => {
  const firebase = useFirebase();
  const navigate = useNavigate();
  const { isUserLoggedIn, currentUser, loginWithGoogle } = useFirebase();

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [rating, setRating] = useState(5);

  // Local Feedback Storage
  const [allFeedback, setAllFeedback] = useState([]);

  const openAddFeedback = (teacher) => {
    if (!isUserLoggedIn) {
      loginWithGoogle();
      return;
    }
    setSelectedTeacher(teacher);
    setShowModal(true);
  };

  const submitFeedback = () => {
    if (feedbackText.trim() === "") return;

    const newEntry = {
      teacher: selectedTeacher.name,
      feedback: feedbackText,
      rating,
      user: currentUser.displayName,
      time: new Date().toLocaleString(),
    };

    setAllFeedback([...allFeedback, newEntry]);
    setShowModal(false);
    setFeedbackText("");
    setRating(5);
  };

  const handleViewFeedback = (teacher) => {
    navigate(`/feedback/${teacher.name}`);
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">

      {/* Background Glow */}
      <div className="absolute top-[-150px] right-[-150px] w-[350px] h-[350px] bg-[#24cfa6] rounded-full blur-[160px] opacity-40"></div>
      <div className="absolute bottom-[-150px] left-[-150px] w-[350px] h-[350px] bg-[#24cfa6] rounded-full blur-[160px] opacity-40"></div>

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 w-full flex flex-row bg-black/40 backdrop-blur-md border-b border-white/10 justify-between text-white z-50">
        <div className="left flex flex-row">
          <img
            className="w-20 h-20 ms-20"
            src="https://cdn.creazilla.com/icons/3432265/teacher-icon-lg.png"
            alt="logo"
          />
          <div className="name mt-7 mx-5 text-lg font-medium">Parikshak AI</div>
        </div>

        <div className="right flex flex-row justify-around items-center">
          <span onClick={() => navigate('/')} className="mx-10 cursor-pointer">Home</span>
          <span onClick={() => navigate("/insights")} className="mx-10 cursor-pointer">Insights</span>
          <span onClick={() => navigate('/textanalysis')} className="mx-10 cursor-pointer">Upload & Analyse</span>
          <span onClick={() => navigate("/live")} className="mx-10 cursor-pointer">Live Monitor</span>
          <span className="mx-10 cursor-pointer">Feedback</span>

          {isUserLoggedIn ? (
            <img
              src={currentUser.photoURL || "/fallback-avatar.png"}
              className="mx-10 w-10 h-10 rounded-full border border-white"
              alt="User"
            />
          ) : (
            <button className="mx-10 bg-[#24cfa6] h-9 w-28 rounded" onClick={() => navigate("/login")}>
              Sign In
            </button>
          )}
        </div>
      </nav>

      {/* HEADER */}
      <div className="pt-32 pb-10 text-center">
        <h1 className="text-4xl font-semibold mb-4 tracking-wide">Teacher Feedback</h1>
        <p className="text-gray-300 text-lg max-w-2xl mx-auto">
          Explore insights and add feedback for each teacher.
        </p>
      </div>

      {/* TEACHER GRID */}
      <div className="px-10 pb-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {teacherData.map((t, idx) => (
          <div
            key={idx}
            className="bg-white/5 border border-white/10 p-6 backdrop-blur-md rounded-2xl 
                       shadow-lg hover:shadow-[#24cfa6]/30 hover:border-[#24cfa6] 
                       transition transform hover:-translate-y-2"
          >
            <h2 className="text-xl font-semibold">{t.name}</h2>
            <p className="text-gray-400 mb-4">{t.subject}</p>

            <p className="text-sm">Feedback Count: <span className="text-[#24cfa6]">{t.count}</span></p>
            <p className="text-sm mb-4">Rating: <span className="text-yellow-400">{t.rating}</span></p>

            {/* Authenticity */}
            <div className="mb-4">
              <p className="text-sm mb-1">Authenticity</p>
              <div className="w-full h-2 bg-gray-800 rounded-full">
                <div className="h-full bg-[#24cfa6] rounded-full" style={{ width: `${t.authenticity}%` }}></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">{t.authenticity}%</p>
            </div>

            {/* Bias */}
            <div className="mb-4">
              <p className="text-sm mb-1">Bias</p>
              <div className="w-full h-2 bg-gray-800 rounded-full">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: `${t.bias}%` }}></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">{t.bias}%</p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => handleViewFeedback(t)}
                className="w-1/2 py-2 bg-[#1e293b] hover:bg-[#243447] rounded-lg font-medium"
              >
                View 
              </button>

              <button
                onClick={() => openAddFeedback(t)}
                className="w-1/2 py-2 bg-[#24cfa6] hover:bg-[#1ba988] rounded-lg text-black font-semibold"
              >
                Add +
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL - ADD FEEDBACK */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex justify-center items-center z-50">
          <div className="bg-white/10 p-8 rounded-2xl border border-white/20 w-[90%] max-w-md">

            <h2 className="text-2xl font-semibold mb-3">
              Add Feedback for <span className="text-[#24cfa6]">{selectedTeacher.name}</span>
            </h2>

            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Write your feedback..."
              className="w-full h-28 p-3 rounded-lg bg-black/40 border border-white/20 outline-none"
            ></textarea>

            {/* Rating */}
            <div className="mt-4">
              <p className="text-sm mb-1">Rating</p>
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="w-full p-2 rounded-md bg-black/50 border border-white/20"
              >
                <option value="5">5 - Excellent</option>
                <option value="4">4 - Very Good</option>
                <option value="3">3 - Average</option>
                <option value="2">2 - Poor</option>
                <option value="1">1 - Very Bad</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-700 rounded-lg">
                Cancel
              </button>
              <button
                onClick={submitFeedback}
                className="px-4 py-2 bg-[#24cfa6] rounded-lg text-black font-semibold"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Feedback;
