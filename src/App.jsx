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

function App() {
  const [count, setCount] = useState(0)

  return (
    <Routes>
      <Route path='/' element={<Home/>}/>
      <Route path='/login' element={<Login/>}/>
      <Route path='/signup' element={<Register/>}/>
      <Route path='/textanalysis' element={<Upload/>}/>
      <Route path='/insights' element={<Insights/>}/>
      <Route path='/feedback' element={<Feedback/>}/>
      <Route path='/live' element={<Live/>}/>
    </Routes>
  )
}

export default App
