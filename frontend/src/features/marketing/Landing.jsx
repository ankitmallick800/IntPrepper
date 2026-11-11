import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Zap, Brain, Mic, BarChart3, ArrowRight, Sparkles, BookOpen, Clock } from 'lucide-react'
import './Landing.css'

const PARTICLES = Array.from({ length: 20 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  top: `${(index * 53) % 100}%`,
  animationDelay: `${(index % 5) * 0.7}s`,
  animationDuration: `${3 + (index % 4)}s`,
}))

export default function Landing() {
  const features = [
    { icon: <Brain size={28} />, title: 'AI-Generated Questions', desc: 'Powered by LLaMA 3.1 to create tailored interview questions based on your topics.' },
    { icon: <Mic size={28} />, title: 'Voice & Video Recording', desc: 'Record your answers with webcam and mic. Get transcriptions via Whisper AI.' },
    { icon: <BarChart3 size={28} />, title: 'Smart Scoring', desc: 'AI evaluates your answers in real-time with detailed feedback and scoring.' },
    { icon: <Clock size={28} />, title: 'Timed Questions', desc: 'Trivia-style one-by-one questions with countdown timer for realistic pressure.' },
    { icon: <Sparkles size={28} />, title: 'Instant Feedback', desc: 'Get strengths and improvement areas after each answer.' },
    { icon: <BookOpen size={28} />, title: 'Session History', desc: 'Every finished round stays in your history with the score and the answers.' },
  ]

  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div className="hero-particles">
          {PARTICLES.map((particle, index) => (
            <div key={index} className="particle" style={particle} />
          ))}
        </div>

        <motion.div
          className="hero-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <motion.div
            className="hero-badge"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Zap size={14} /> AI-Powered Interview Platform
          </motion.div>

          <h1 className="hero-title">
            Master Your Interview<br />
            <span className="text-gradient">One Question at a Time</span>
          </h1>

          <p className="hero-subtitle">
            IntPrepper builds a practice interview around your topic, records your answer,
            and scores it before the next question — the same rhythm as the real thing.
          </p>

          <div className="hero-actions">
            <Link to="/interview">
              <button className="btn btn-primary btn-lg hero-cta">
                Start Interview <ArrowRight size={18} />
              </button>
            </Link>
          </div>

          <div className="hero-stats">
            <div className="stat">
              <span className="stat-value">AI</span>
              <span className="stat-label">Powered</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">Real-time</span>
              <span className="stat-label">Scoring</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <span className="stat-value">1-by-1</span>
              <span className="stat-label">Questions</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="features-section">
        <motion.h2
          className="section-title"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Everything You Need to <span className="text-gradient">Ace Interviews</span>
        </motion.h2>

        <div className="features-grid">
          {features.map((f, i) => (
            <motion.div
              key={i}
              className="feature-card glass-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <motion.div
          className="cta-card"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <h2>Ready to Transform Your Interview Skills?</h2>
          <p>Open IntPrepper, pick a topic, and run a full practice interview in a few minutes.</p>
          <Link to="/interview">
            <button className="btn btn-primary btn-lg">
              Start an Interview <ArrowRight size={18} />
            </button>
          </Link>
        </motion.div>
      </section>

      <footer className="landing-footer">
        <p>© 2026 IntPrepper</p>
      </footer>
    </div>
  )
}
