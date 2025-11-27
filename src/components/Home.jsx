import React, { useState } from 'react'
import { useFirebase } from "../context/Firebase";
import { useNavigate } from "react-router-dom";

const Home = () => {
    const firebase = useFirebase();
    const navigate = useNavigate();
    const { isUserLoggedIn, currentUser, loginWithGoogle } = useFirebase();

    console.log(currentUser); 


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
            <span onClick={() => navigate("/feedback")} className="mx-10">Feedback</span>
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

        <span className="text-6xl mt-12">
          We help you <span className="text-highlight text-[#24cfa6]">
            evaluate
          </span> <br />
          what makes teaching <br />
          truly <span className="italic">effective</span>. <br />
        </span>

        <div className="w-full flex justify-end">
          <div className="side-text text-left me-64">
            Use smart evaluation tools to <br />
            <span className="text-highlight text-[#24cfa6]">
              elevate teacher performance
            </span>
            <br />
            and create better educational experiences <br/>
            for students.
          </div>
        </div>

        <button onClick={()=>navigate("/textanalysis")} className="w-80 h-10 text-black bg-[#24cfa6] rounded-lg text-lg font-semibold mt-5">
          Evaluate Your Teacher Effectively
        </button>

        <div className="bottom w-full py-10 mt-20 mb-10">
          <div className="mileStones flex justify-center gap-16">

            <div className="mileStone text-center">
              <div className="text">
                <h2 className="text-4xl font-bold text-white">20k+</h2>
                <p className="text-lg text-white">Videos Evaluated</p>
              </div>
            </div>

            <div className="mileStone text-center">
              <div className="text">
                <h2 className="text-4xl font-bold text-white">20+</h2>
                <p className="text-lg text-white">Instructor Ratings</p>
              </div>
            </div>

            <div className="mileStone text-center">
              <div className="text">
                <h2 className="text-4xl font-bold text-white">65k+</h2>
                <p className="text-lg text-white">Students Support</p>
              </div>
            </div>

          </div>
        </div>

      </section>
    </div>
  )
}

export default Home
