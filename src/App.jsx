import { useState } from 'react'
import {Routes,Route} from 'react-router-dom'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Register from './components/Register'
import Login from './components/Login'
import Home from './components/Home'
import Upload from './components/Upload'
import Insights from './components/Insights'
import Feedback from './components/Feedback'
import Live from './components/Live'
import Audio from './components/Audio'
import Doubts from './components/Doubts'

function App() {
  // We initialize from localStorage so the role doesn't reset on refresh
  const [userRole, setUserRole] = useState(localStorage.getItem("userRole") || "Student/Admin");

  const updateRole = (newRole) => {
    setUserRole(newRole);
    localStorage.setItem("userRole", newRole); // Persistent storage
  };

  return (
    <Routes>
      <Route path='/' element={<Home userRole={userRole}/>}/>
      
      {/* These two can CHANGE the role */}
      <Route path='/login' element={<Login setUserRole={updateRole}/>}/>
      <Route path='/signup' element={<Register setUserRole={updateRole}/>}/>
      
      {/* These components USE the role */}
      <Route path='/textanalysis' element={<Upload userRole={userRole}/>}/>
      <Route path='/insights' element={<Insights userRole={userRole}/>}/>
      <Route path='/feedback' element={<Feedback userRole={userRole}/>}/>
      <Route path='/live' element={<Live userRole={userRole}/>}/>
      <Route path='/audio' element={<Audio userRole={userRole}/>}/>
      <Route path='/doubts' element={<Doubts userRole={userRole}/>}/>
    </Routes>
  )
}

export default App
