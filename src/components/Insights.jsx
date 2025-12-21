import React, { useState, useEffect } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useFirebase, app } from "../context/Firebase";
import Logo2 from "../pictures/Logo2.png"

const Insights = ({ userRole }) => {
    const firestore = getFirestore(app);

    // START: ADDED/MODIFIED FOR MOBILE MENU
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    
    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const handleNavigation = (path) => {
        navigate(path);
        // Close menu after navigating only if it was a mobile click
        if (isMenuOpen) {
            setIsMenuOpen(false);
        }
    };
    // END: ADDED/MODIFIED FOR MOBILE MENU

    const [teachers, setTeachers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchTeachers = async () => {
            try {
                const querySnapshot = await getDocs(collection(firestore, "teachers"));
                const teachersData = querySnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setTeachers(teachersData);
            } catch (error) {
                console.error("Error fetching teachers: ", error);
            }
        };

        fetchTeachers();
    }, [firestore]);

    const navigate = useNavigate();
    const { isUserLoggedIn, currentUser, loginWithGoogle } = useFirebase();

    // Normalize search term once
    const normalizedSearch = (searchTerm || "").trim().toLowerCase();

    // Helper to safely compute a displayable rating
    const computeRatingDisplay = (rating) => {
        if (rating == null) return "N/A";

        // If rating is a number
        if (typeof rating === "number") {
            return Number.isFinite(rating) ? rating.toFixed(1) : "N/A";
        }

        // If rating is a string like "4.5/5"
        if (typeof rating === "string") {
            return rating;
        }

        // If rating is an array (old format)
        if (Array.isArray(rating) && rating.length > 0) {
            const nums = rating.filter((r) => typeof r === "number" && Number.isFinite(r));
            if (nums.length === 0) return "N/A";
            const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
            return avg.toFixed(1);
        }

        return "N/A";
    };

    // FILTER: if searchTerm is empty -> show all teachers; otherwise filter by name includes
    const filteredTeachers = normalizedSearch
        ? teachers.filter((t) => {
            const name = (t?.name || "").toString().toLowerCase();
            return name.includes(normalizedSearch);
        })
        : teachers;

    return (
        <section
            className="w-full min-h-screen flex flex-col items-center justify-around bg-black
text-white text-center pt-20 relative overflow-hidden"
        >

            <div className="absolute top-[-150px] right-[-50px] w-[350px] h-[350px] bg-[#24cfa6] rounded-full blur-[160px] opacity-70"></div>
                <div className="absolute bottom-[-150px] left-[-150px] w-[350px] h-[350px] bg-[#24cfa6] rounded-full blur-[160px] opacity-70"></div>

            {/* NAVBAR - MODIFIED FOR MOBILE */}
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

            <h2 className="text-xl font-bold mb-8 mt-10 text-center text-white">
                Search by Name
            </h2>

            {/* SEARCH INPUT (logic wired) - NO CHANGE */}
            <div>
                <input
                    className="border-2 border-white hover:border-[#24cfa6] h-8 w-80 p-2"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Type a teacher's name..."
                />
            </div>

            <div className="container mx-auto mt-10 p-4 max-w-7xl">
                <h2 className="text-xl font-bold text-white mb-8 text-center">
                    Instructors
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* DYNAMIC CARDS (filtered) - NO CHANGE */}
                    {filteredTeachers.map((item, index) => (
                        <div
                            key={item.id || index}
                            className="bg-gray-900 rounded-lg p-4 shadow-md border border-gray-800 hover:border-[#24cfa6] transition-all duration-300 flex flex-col justify-between h-36 group"
                        >
                            <div className="flex justify-between items-start">
                                <h3 className="text-base font-bold text-white group-hover:text-[#24cfa6] transition-colors truncate pr-2">
                                    {item.name}
                                </h3>
                                <div className="flex items-center gap-1 bg-gray-800 h-8 px-1.5 py-0.5 rounded-md shrink-0">
                                    <span className="text-[#24cfa6] text-[14px]">★</span>
                                    <span className="text-white text-[14px] font-semibold">
                                        {computeRatingDisplay(item.rating)}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {(item.topics || []).map((it, ind) => (
                                        <span
                                            key={ind}
                                            className="bg-[#24cfa6]/10 text-[#24cfa6] text-[10px] px-1.5 py-0.5 rounded-full border border-[#24cfa6]/20"
                                        >
                                            {it}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Insights;