import React, { useState } from 'react';
import { useFirebase } from "../context/Firebase";
import { useNavigate } from "react-router-dom";
import Logo2 from "../pictures/Logo2.png";

const Doubts = ({ userRole }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { isUserLoggedIn, currentUser } = useFirebase();
    const navigate = useNavigate();

    // Toggle function for the sandwich button
    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const handleNavigation = (path) => {
        navigate(path);
        if (isMenuOpen) {
            setIsMenuOpen(false);
        }
    };

    // 🌟 DUMMY DATA FOR FRONTEND (No Student Names)
    const dummyDoubts = [
        {
            id: 1,
            subject: "Data Structures",
            topic: "Linked List",
            question: "Sir, I am confused about the time complexity of deleting a node from a doubly linked list. is it O(1) or O(n)?",
            timestamp: "2 hours ago",
            status: "Pending"
        },
        {
            id: 2,
            subject: "Operating Systems",
            topic: "Semaphores",
            question: "Can you please explain the difference between a binary semaphore and a mutex with a real-world example?",
            timestamp: "5 hours ago",
            status: "Pending"
        },
        {
            id: 3,
            subject: "DBMS",
            topic: "Normalization",
            question: "I processed the query regarding 3NF but I am stuck on BCNF. Why is BCNF considered stricter than 3NF?",
            timestamp: "1 day ago",
            status: "Answered"
        },
        {
            id: 4,
            subject: "Computer Networks",
            topic: "TCP/IP",
            question: "In the sliding window protocol, what happens if the acknowledgement is lost? Does the sender retransmit everything?",
            timestamp: "2 days ago",
            status: "Pending"
        },
        {
            id: 5,
            subject: "Algorithms",
            topic: "Dynamic Programming",
            question: "How do I identify if a problem can be solved using DP? I usually mix it up with Greedy approach.",
            timestamp: "3 days ago",
            status: "Answered"
        }
    ];

    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-[#24cfa6] selection:text-black relative overflow-x-hidden">
            
            {/* BACKGROUND BLURS */}
            <div className="absolute top-[-150px] right-[-50px] w-[350px] h-[350px] bg-[#24cfa6] rounded-full blur-[160px] opacity-40 pointer-events-none fixed"></div>
            <div className="absolute bottom-[-150px] left-[-150px] w-[350px] h-[350px] bg-[#24cfa6] rounded-full blur-[160px] opacity-40 pointer-events-none fixed"></div>

            {/* NAV BAR */}
            <nav className="fixed top-0 left-0 w-full flex bg-black/80 backdrop-blur-md justify-between text-white z-50 border-b border-gray-800">
                <div className="left flex flex-row items-center p-2 sm:p-0">
                    <img className="w-10 h-10 sm:w-14 sm:h-14 ms-4 mt-2 sm:ms-20 object-cover" src={Logo2} alt="Logo" />
                    <div className="name mt-2 mx-3 text-lg sm:text-xl font-bold tracking-wide">Parikshak AI</div>
                </div>

                {/* Desktop Navigation */}
                <div className="right hidden sm:flex flex-row justify-around items-center">
                    <span className="mx-6 cursor-pointer hover:text-[#24cfa6] transition-colors" onClick={() => handleNavigation("/")}>Home</span>
                    
                    {userRole === "Student/Admin" && (
                        <span onClick={() => handleNavigation("/insights")} className="mx-6 cursor-pointer hover:text-[#24cfa6] transition-colors">Insights</span>
                    )}

                    <span onClick={() => handleNavigation('/textanalysis')} className="mx-6 cursor-pointer hover:text-[#24cfa6] transition-colors">Upload & Analyse</span>
                    <span onClick={() => handleNavigation("/live")} className="mx-6 cursor-pointer hover:text-[#24cfa6] transition-colors">Live Monitor</span>
                    <span onClick={() => handleNavigation("/audio")} className="mx-6 cursor-pointer hover:text-[#24cfa6] transition-colors">Audio Analysis</span>

                    {userRole === "Student/Admin" ? (
                        <span onClick={() => handleNavigation("/feedback")} className="mx-6 cursor-pointer hover:text-[#24cfa6] transition-colors">Feedback</span>
                    ) : (
                        <span onClick={() => handleNavigation("/doubts")} className="mx-6 cursor-pointer text-[#24cfa6] font-semibold">Doubts</span>
                    )}

                    {isUserLoggedIn ? (
                        <img
                            src={currentUser?.photoURL || "/fallback-avatar.png"}
                            alt="User Profile"
                            className="mx-10 w-10 h-10 rounded-full border-2 border-[#24cfa6] cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => handleNavigation("/profile")}
                        />
                    ) : (
                        <button className="mx-10 bg-[#24cfa6] h-9 w-28 rounded text-black font-bold hover:bg-[#1b9a7c] transition-colors" onClick={() => handleNavigation("/login")}>
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
            <div className={`fixed top-16 left-0 w-full bg-black/95 backdrop-blur-sm z-40 sm:hidden transition-all duration-300 ease-in-out ${isMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                <div className="flex flex-col items-center py-4 space-y-3 border-b border-gray-800">
                    <span onClick={() => handleNavigation("/")} className="w-full text-center py-2 hover:bg-[#24cfa6]/20 cursor-pointer text-lg">Home</span>
                    {userRole === "Student/Admin" && <span onClick={() => handleNavigation("/insights")} className="w-full text-center py-2 hover:bg-[#24cfa6]/20 cursor-pointer text-lg">Insights</span>}
                    <span onClick={() => handleNavigation('/textanalysis')} className="w-full text-center py-2 hover:bg-[#24cfa6]/20 cursor-pointer text-lg">Upload & Analyse</span>
                    <span onClick={() => handleNavigation("/live")} className="w-full text-center py-2 hover:bg-[#24cfa6]/20 cursor-pointer text-lg">Live Monitor</span>
                    <span onClick={() => handleNavigation("/audio")} className="w-full text-center py-2 hover:bg-[#24cfa6]/20 cursor-pointer text-lg">Audio Analysis</span>
                    <span onClick={() => handleNavigation("/doubts")} className="w-full text-center py-2 bg-[#24cfa6]/10 text-[#24cfa6] font-bold cursor-pointer text-lg">Doubts</span>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <main className="w-full max-w-7xl mx-auto pt-28 pb-10 px-4 relative z-10">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-8">
                    <div className="text-left">
                        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Student <span className="text-[#24cfa6]">Doubts</span></h1>
                        <p className="text-gray-400">Review and answer queries from your recent lectures.</p>
                    </div>
                    
                    <div className="mt-4 md:mt-0 flex gap-4">
                        <button className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-700 transition-colors">
                            Filter by Subject
                        </button>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="mb-8">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input 
                            type="text" 
                            className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl leading-5 bg-gray-900 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-gray-800 focus:border-[#24cfa6] transition duration-150 ease-in-out" 
                            placeholder="Search for topics, keywords..." 
                        />
                    </div>
                </div>

                {/* DOUBTS LIST */}
                <div className="grid gap-6">
                    {dummyDoubts.map((doubt) => (
                        <div key={doubt.id} className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-xl p-6 hover:border-[#24cfa6] transition-all duration-300 group text-left">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-2">
                                    <span className="bg-blue-900/30 text-blue-400 text-xs font-bold px-3 py-1 rounded-full border border-blue-900/50">
                                        {doubt.subject}
                                    </span>
                                    <span className="bg-purple-900/30 text-purple-400 text-xs font-bold px-3 py-1 rounded-full border border-purple-900/50">
                                        {doubt.topic}
                                    </span>
                                </div>
                                <span className="text-gray-500 text-sm flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {doubt.timestamp}
                                </span>
                            </div>

                            <h3 className="text-lg md:text-xl font-semibold text-white mb-2 group-hover:text-[#24cfa6] transition-colors">
                                {doubt.question}
                            </h3>

                            <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-800">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${doubt.status === 'Resolved' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></span>
                                    <span className="text-sm text-gray-400">{doubt.status === 'Resolved' ? 'Resolved' : 'Pending Response'}</span>
                                </div>
                                
                                <button className="flex items-center gap-2 text-[#24cfa6] hover:text-white font-medium text-sm transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                    </svg>
                                    Reply to Query
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty State / Pagination Placeholder */}
                <div className="mt-8 text-center">
                    <p className="text-gray-500 text-sm">Showing 5 of 24 pending queries</p>
                    <button className="mt-2 text-[#24cfa6] text-sm hover:underline">Load More</button>
                </div>

            </main>
        </div>
    );
}

export default Doubts;