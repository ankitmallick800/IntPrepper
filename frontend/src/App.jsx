import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Landing from './features/marketing/Landing'
import About from './features/marketing/About'
import InterviewSetup from './features/interview/InterviewSetup'
import InterviewLive from './features/interview/InterviewLive'
import InterviewResults from './features/interview/InterviewResults'
import History from './features/history/History'

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '')

function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <div className="bg-mesh" />
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/interview" element={<InterviewSetup />} />
        <Route path="/interview/live" element={<InterviewLive />} />
        <Route path="/interview/results" element={<InterviewResults />} />
        <Route path="/history" element={<History />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
