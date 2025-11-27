import React, { useState, useEffect } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useFirebase, app } from "../context/Firebase";

const Insights = () => {
  const firestore = getFirestore(app);

  const [teachers, setTeachers] = useState([]);

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
  }, []);
  const navigate = useNavigate();
  const { isUserLoggedIn, currentUser, loginWithGoogle } = useFirebase();
  return (
    <section
      className="w-full flex flex-col items-center justify-around bg-black
 text-white text-center pt-20 relative overflow-hidden"
    >
      {/* TOP-RIGHT PATCH */}
      <div
        className="absolute top-[-150px] right-[-150px] 
                w-[350px] h-[350px]
                bg-[#24cfa6] rounded-full blur-[160px] opacity-40"
      ></div>

      {/* BOTTOM-LEFT PATCH */}
      <div
        className="absolute bottom-[-150px] left-[-150px] 
                w-[350px] h-[350px] 
                bg-[#24cfa6] rounded-full blur-[160px] opacity-40"
      ></div>

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
          <span onClick={() => navigate("/")} className="mx-10">
            Home
          </span>
          <span className="mx-10">Insights</span>
          <span onClick={() => navigate("/textanalysis")} className="mx-10">
            Upload & Analyse
          </span>
          <span onClick={() => navigate("/feedback")} className="mx-10">Feedback</span>
          {isUserLoggedIn ? (
            <img
              src={currentUser.photoURL || "/fallback-avatar.png"}
              alt="https://media.istockphoto.com/id/1553217327/vector/user-profile-icon-avatar-person-sign-profile-picture-portrait-symbol-easily-editable-line.jpg?s=170667a&w=0&k=20&c=xUuHLFaa94WIFdV-XBgxX9SSsaJJgGQhE1Tmevqrytg="
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

      <div>
        <input className="border-2 border-white hover:border-[#24cfa6]" type="text" placeholder="Search by name" />
      </div>
      <div className="container mx-auto mt-10 p-4 max-w-7xl">
        <h2 className="text-xl font-bold text-white mb-8 text-center">
          {" "}
          Instructors
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {teachers.map((item, index) => (
            <div
              key={index}
              className="bg-gray-900 rounded-lg p-4 shadow-md border border-gray-800 hover:border-[#24cfa6] transition-all duration-300 flex flex-col justify-between h-36 group"
            >
              <div className="flex justify-between items-start">
                <h3 className="text-base font-bold text-white group-hover:text-[#24cfa6] transition-colors truncate pr-2">
                  {item.name}
                </h3>
                <div className="flex items-center gap-1 bg-gray-800 h-8 px-1.5 py-0.5 rounded-md shrink-0">
                  <span className="text-[#24cfa6] text-[14px]">★</span>
                  <span className="text-white text-[14px] font-semibold">
                    {item.rating && item.rating.length > 0
                      ? (
                          item.rating.reduce((a, b) => a + b, 0) /
                          item.rating.length
                        ).toFixed(1)
                      : "N/A"}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {item.topics.map((it, ind) => (
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
