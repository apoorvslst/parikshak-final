import React, { useState } from 'react'
import { useFirebase } from "../context/Firebase";
import { useNavigate } from "react-router-dom";
import Logo2 from "../pictures/Logo2.png"
import useravatar from "../pictures/useravatar.jpg";

const Home = ({ userRole }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navigate = useNavigate();
    const { isUserLoggedIn, currentUser } = useFirebase();

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const handleNavigation = (path) => {
        navigate(path);
        if (isMenuOpen) {
            setIsMenuOpen(false);
        }
    };

    return (
        <div>
            <section className="w-full flex flex-col items-center justify-around bg-black text-white text-center pt-20 relative overflow-hidden h-full">
                
                {/* Background Glows */}
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

                {/* Hero Section */}
                <span className="text-6xl mt-12">
                    We help you <span className="text-highlight text-[#24cfa6]">evaluate</span> <br />
                    what makes teaching <br />
                    truly <span className="italic">effective</span>. <br />
                </span>

                <div className="w-full flex justify-end">
                    <div className="side-text text-left me-64">
                        Use smart evaluation tools to <br />
                        <span className="text-highlight text-[#24cfa6]">elevate teacher performance</span><br />
                        and create better educational experiences <br />
                        for students.
                    </div>
                </div>

                <button onClick={() => handleNavigation("/textanalysis")} className="w-80 h-10 text-black bg-[#24cfa6] rounded-lg text-lg font-semibold mt-5">
                    {userRole === "teacher" ? "Review Submissions" : "Evaluate Your Teacher Effectively"}
                </button>

                {/* Milestones */}
                <div className="bottom w-full py-10 mt-20 mb-10">
                    <div className="mileStones flex justify-center gap-16">
                        <div className="mileStone text-center">
                            <h2 className="text-4xl font-bold text-white">20k+</h2>
                            <p className="text-lg text-white">Videos Evaluated</p>
                        </div>
                        <div className="mileStone text-center">
                            <h2 className="text-4xl font-bold text-white">20+</h2>
                            <p className="text-lg text-white">Instructor Ratings</p>
                        </div>
                        <div className="mileStone text-center">
                            <h2 className="text-4xl font-bold text-white">65k+</h2>
                            <p className="text-lg text-white">Students Support</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

export default Home;