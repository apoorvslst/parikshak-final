import React, { useState } from "react";
import { useFirebase } from "../context/Firebase";
import { useNavigate } from "react-router-dom";
import Logo2 from "../pictures/Logo2.png";

const teacherData = [
  { name: "Mr. ABC", subject: "Mathematics", count: 45, rating: "4.5/5", authenticity: 85, bias: 15 },
  { name: "Mr. ABX", subject: "Physics", count: 32, rating: "3.5/5", authenticity: 85, bias: 15 },
  { name: "Mr. Don", subject: "Chemistry", count: 58, rating: "5/5", authenticity: 88, bias: 12 },
  { name: "Ms. Arti", subject: "Biology", count: 38, rating: "4/5", authenticity: 90, bias: 10 },
  { name: "Mrs. Jaya", subject: "English", count: 28, rating: "3.5/5", authenticity: 95, bias: 5 },
  { name: "Mr. Kishore", subject: "History", count: 45, rating: "4.3/5", authenticity: 85, bias: 15 },
];

const Feedback = ({ userRole }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { isUserLoggedIn, currentUser, loginWithGoogle } = useFirebase();

  // Modal & Form States
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState("feedback"); // "feedback" or "doubt"
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  
  // Feedback States
  const [feedbackText, setFeedbackText] = useState("");
  const [rating, setRating] = useState(5);
  const [allFeedback, setAllFeedback] = useState([]);

  // Doubt States
  const [doubtText, setDoubtText] = useState("");
  const [allDoubts, setAllDoubts] = useState([]);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const handleNavigation = (path) => {
    navigate(path);
    if (isMenuOpen) setIsMenuOpen(false);
  };

  const openModal = (teacher, tab = "feedback") => {
    if (!isUserLoggedIn) {
      loginWithGoogle();
      return;
    }
    setSelectedTeacher(teacher);
    setActiveTab(tab);
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (activeTab === "feedback") {
      if (feedbackText.trim() === "") return;
      const newEntry = {
        teacher: selectedTeacher.name,
        feedback: feedbackText,
        rating,
        user: currentUser.displayName,
        time: new Date().toLocaleString(),
      };
      setAllFeedback([...allFeedback, newEntry]);
      setFeedbackText("");
    } else {
      if (doubtText.trim() === "") return;
      const newDoubt = {
        teacher: selectedTeacher.name,
        question: doubtText,
        user: currentUser.displayName,
        status: "Pending",
        time: new Date().toLocaleString(),
      };
      setAllDoubts([...allDoubts, newDoubt]);
      setDoubtText("");
    }
    setShowModal(false);
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-150px] right-[-50px] w-[350px] h-[350px] bg-[#24cfa6] rounded-full blur-[160px] opacity-70"></div>
                <div className="absolute bottom-[-150px] left-[-150px] w-[350px] h-[350px] bg-[#24cfa6] rounded-full blur-[160px] opacity-70"></div>

      {/* NAVBAR */}
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

      {/* HEADER */}
      <div className="pt-32 pb-10 text-center">
        <h1 className="text-4xl font-semibold mb-4 tracking-wide">Feedback & Doubt Support</h1>
        <p className="text-gray-300 text-lg max-w-2xl mx-auto px-4">
          Provide feedback on teaching quality or ask doubts directly to your educators.
        </p>
      </div>

      {/* TEACHER GRID */}
      <div className="px-10 pb-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {teacherData.map((t, idx) => (
          <div key={idx} className="bg-white/5 border border-white/10 p-6 backdrop-blur-md rounded-2xl shadow-lg hover:shadow-[#24cfa6]/30 hover:border-[#24cfa6] transition transform hover:-translate-y-2">
            <h2 className="text-xl font-semibold">{t.name}</h2>
            <p className="text-gray-400 mb-4">{t.subject}</p>
            <div className="flex justify-between text-sm mb-4">
              <span>Rating: <span className="text-yellow-400">{t.rating}</span></span>
              <span>Authenticity: <span className="text-[#24cfa6]">{t.authenticity}%</span></span>
            </div>

            <div className="flex flex-col gap-3 mt-3">
              <div className="flex gap-2">
                <button onClick={() => navigate(`/feedback/${t.name}`)} className="flex-1 py-2 bg-[#1e293b] hover:bg-[#243447] rounded-lg font-medium text-sm">View Stats</button>
                <button onClick={() => openModal(t, "feedback")} className="flex-1 py-2 bg-[#24cfa6] hover:bg-[#1ba988] rounded-lg text-black font-semibold text-sm">Feedback +</button>
              </div>
              <button onClick={() => openModal(t, "doubt")} className="w-full py-2 border border-[#24cfa6] text-[#24cfa6] hover:bg-[#24cfa6] hover:text-black transition-all rounded-lg font-medium text-sm">
                Ask a Doubt ?
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL SYSTEM */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-50 p-4">
          <div className="bg-[#111] p-6 rounded-2xl border border-white/20 w-full max-w-md shadow-2xl">
            
            {/* Tab Switcher */}
            <div className="flex bg-white/5 p-1 rounded-xl mb-6">
              <button 
                onClick={() => setActiveTab("feedback")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "feedback" ? "bg-[#24cfa6] text-black" : "text-gray-400"}`}
              >
                Feedback
              </button>
              <button 
                onClick={() => setActiveTab("doubt")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "doubt" ? "bg-[#24cfa6] text-black" : "text-gray-400"}`}
              >
                Ask Doubt
              </button>
            </div>

            <h2 className="text-xl font-semibold mb-4">
              {activeTab === "feedback" ? "Rate " : "Query for "} 
              <span className="text-[#24cfa6]">{selectedTeacher.name}</span>
            </h2>

            {activeTab === "feedback" ? (
              <div className="space-y-4">
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="How was your experience with this teacher?"
                  className="w-full h-28 p-3 rounded-lg bg-black/40 border border-white/10 focus:border-[#24cfa6] outline-none"
                />
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest">Rating</label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full mt-1 p-3 rounded-lg bg-black border border-white/10"
                  >
                    {[5,4,3,2,1].map(num => <option key={num} value={num}>{num} Stars</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-400 italic">Your doubt will be sent directly to the teacher's dashboard.</p>
                <textarea
                  value={doubtText}
                  onChange={(e) => setDoubtText(e.target.value)}
                  placeholder="Type your question here (e.g. Can you explain the Chain Rule again?)"
                  className="w-full h-40 p-3 rounded-lg bg-black/40 border border-white/10 focus:border-[#24cfa6] outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-5 py-2 text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={handleSubmit} className="px-8 py-2 bg-[#24cfa6] rounded-lg text-black font-bold hover:scale-105 transition-transform">
                Submit {activeTab === "feedback" ? "Feedback" : "Doubt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feedback;