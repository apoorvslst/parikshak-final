import React, { useState } from "react";
import { useFirebase } from "../context/Firebase";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const firebase = useFirebase();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handlesubmit = async (e) => {
    e.preventDefault();
    await firebase.loginuser(email, password);
    navigate("/");
  };

  const handleGoogleLogin = async () => {
    await firebase.loginWithGoogle();
    navigate("/");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: "linear-gradient(135deg, #0d0d0d, #111418)",
      }}
    >
      <div
        className="w-full max-w-md rounded-xl p-8 shadow-lg backdrop-blur-sm"
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <h2
          className="text-3xl font-semibold text-center mb-8"
          style={{ color: "#24CFA6" }}
        >
          Login
        </h2>

        <form className="space-y-6">
          <div>
            <label className="block mb-1 text-gray-300">Email</label>
            <input
              onChange={(e) => setEmail(e.target.value)}
              value={email}
              type="email"
              className="w-full px-4 py-3 rounded-lg bg-black/20 text-white 
                         border border-gray-700 outline-none transition
                         focus:border-[#24CFA6] focus:shadow-[0_0_6px_#24CFA6]"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block mb-1 text-gray-300">Password</label>
            <input
              onChange={(e) => setPassword(e.target.value)}
              value={password}
              type="password"
              className="w-full px-4 py-3 rounded-lg bg-black/20 text-white 
                         border border-gray-700 outline-none transition
                         focus:border-[#24CFA6] focus:shadow-[0_0_6px_#24CFA6]"
              placeholder="********"
            />
          </div>

          <button
            onClick={handlesubmit}
            type="button"
            className="w-full py-3 font-semibold rounded-lg transition text-black"
            style={{
              background: "#24CFA6",
              boxShadow: "0 0 6px #00e676",
            }}
          >
            Login
          </button>
        </form>

        {/* Google Login */}
        <div className="mt-6">
          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 flex items-center justify-center gap-3 rounded-lg 
                       bg-white/10 text-white border border-gray-600 hover:bg-white/20 
                       transition font-medium"
          >
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              alt="google"
              className="w-5 h-5"
            />
            Continue with Google
          </button>
        </div>

        <p className="text-gray-400 text-center mt-6">
          Don’t have an account?{" "}
          <span
            onClick={() => navigate("/signup")}
            className="cursor-pointer font-semibold"
            style={{ color: "#24CFA6" }}
          >
            Register
          </span>
        </p>
      </div>
    </div>
  );
};

export default Login;
