import React, { useState } from 'react'
import { useFirebase } from "../context/Firebase";
import { useNavigate } from "react-router-dom";

const Feedback = () => {
        const firebase = useFirebase();
            const navigate = useNavigate();
            const { isUserLoggedIn, currentUser, loginWithGoogle } = useFirebase();
  return (
    <div>
      <section className="w-full flex flex-col items-center justify-around bg-black
 text-white text-center pt-20 relative overflow-hidden">

        {/* TOP-RIGHT PATCH */}
        <div className="absolute top-[-150px] right-[-150px] 
                w-[350px] h-[350px]
                bg-[#24cfa6] rounded-full blur-[160px] opacity-40">
        </div>

        {/* BOTTOM-LEFT PATCH */}
        <div className="absolute bottom-[-150px] left-[-150px] 
                w-[350px] h-[350px] 
                bg-[#24cfa6] rounded-full blur-[160px] opacity-40">
        </div>

        <nav className="fixed top-0 left-0 w-full flex flex-row bg-transparent justify-between text-white">
          <div className="left flex flex-row">
            <img
              className="w-20 h-20 ms-20"
              src="https://cdn.creazilla.com/icons/3432265/teacher-icon-lg.png"
              alt=""
            />
            <div className="name mt-7 mx-5 text-lg font-medium">
              Parikshak AI
            </div>
          </div>

          <div className="right flex flex-row justify-around items-center">
            <span onClick={()=>navigate('/')} className="mx-10">Home</span>
            <span onClick={()=>navigate("/insights")} className="mx-10">Insights</span>
            <span onClick={()=>navigate('/textanalysis')} className="mx-10">Upload & Analyse</span>
            <span className="mx-10">Feedback</span>
            {isUserLoggedIn ? (
  <img
    src={currentUser.photoURL || "/fallback-avatar.png"}
    alt="https://media.istockphoto.com/id/1553217327/vector/user-profile-icon-avatar-person-sign-profile-picture-portrait-symbol-easily-editable-line.jpg?s=170667a&w=0&k=20&c=xUuHLFaa94WIFdV-XBgxX9SSsaJJgGQhE1Tmevqrytg="
    className="mx-10 w-10 h-10 rounded-full border border-white"
  />
) : (
  <button className="mx-10 bg-[#24cfa6] h-9 w-28 rounded" onClick={()=>navigate("/login")}>
    Sign In
  </button>
)}
          </div>
        </nav>
        </section>
    </div>
  )
}

export default Feedback
