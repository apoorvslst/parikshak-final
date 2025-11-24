// src/context/Firebase.js
import { initializeApp } from "firebase/app";
import { createContext, useContext, useState, useEffect } from "react";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  onAuthStateChanged
} from "firebase/auth";

const FirebaseContext = createContext(null);
export const useFirebase = () => useContext(FirebaseContext);

const firebaseConfig = {
  apiKey: "AIzaSyCzJUmrLZYTrfJprNgBceheXxvuHTDEMNQ",
  authDomain: "iitb-tf.firebaseapp.com",
  projectId: "iitb-tf",
  storageBucket: "iitb-tf.firebasestorage.app",
  messagingSenderId: "56071797434",
  appId: "1:56071797434:web:1d40e7bf5799c7850f6083",
  measurementId: "G-E7XZLMJH4Q"
};

const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
export { firebaseApp as app };

export const FirebaseProvider = ({ children = null }) => {
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
const [currentUser, setCurrentUser] = useState(null);

useEffect(() => {
  const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
    setIsUserLoggedIn(!!user);
    setCurrentUser(user); 
  });

  return () => unsubscribe();
}, []);

  const signupuser = async(email, password) => {
    return await createUserWithEmailAndPassword(firebaseAuth, email, password);
  };

  const loginuser = async(email, password) => {
    return await signInWithEmailAndPassword(firebaseAuth, email, password);
  };
  

  const provider = new GoogleAuthProvider();
   provider.addScope("profile");
provider.addScope("email");
  const loginWithGoogle = async() => {

    return await signInWithPopup(firebaseAuth, provider);
  };

  const value = { 
    signupuser, 
    loginuser, 
    loginWithGoogle,
    isUserLoggedIn,
    currentUser  
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};
