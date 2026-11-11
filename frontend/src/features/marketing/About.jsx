import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Brain, Mic, BarChart3, BookOpen } from 'lucide-react'
import './About.css'

export default function About() {
  return (
    <div className="about-page">
      <motion.div
        className="about-container page-container medium"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="about-card glass-card">
          <h1 className="about-title">
            About <span className="text-gradient">IntPrepper</span>
          </h1>

          <div className="about-content">
            <p>
              IntPrepper is a practice room for interviews. You choose the role and the topics,
              and the app asks one question at a time with a countdown, the same way a live round feels.
            </p>

            <p>
              Answer by speaking on camera or by typing. Speech answers are transcribed, then each
              response is scored with short feedback, strengths, and things to tighten up.
            </p>

            <p>
              When the round ends you get an overall score and a question-by-question breakdown.
              Past sessions stay in your history so you can see what improved.
            </p>

            <p>
              Question generation and scoring use Groq when an API key is configured. Without one,
              IntPrepper still runs the full practice flow with built-in questions and tells you that
              AI scoring is off.
            </p>
          </div>

          <div className="about-features">
            <div className="about-feature">
              <Brain size={24} />
              <span>AI Question Generation</span>
            </div>
            <div className="about-feature">
              <Mic size={24} />
              <span>Voice Analysis</span>
            </div>
            <div className="about-feature">
              <BarChart3 size={24} />
              <span>Smart Scoring</span>
            </div>
            <div className="about-feature">
              <BookOpen size={24} />
              <span>Session History</span>
            </div>
          </div>

          <Link to="/" className="btn btn-secondary" style={{ marginTop: '24px' }}>
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
