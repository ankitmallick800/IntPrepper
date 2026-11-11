import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Clock, Target, FileText, ArrowRight, Loader2 } from 'lucide-react'
import { api } from '../../api/client'
import { unlockInterviewAudio } from '../../lib/interviewAudio'
import './InterviewSetup.css'

export default function InterviewSetup() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [aiNote, setAiNote] = useState('')

  useEffect(() => {
    api.health()
      .then((data) => {
        if (!data.ai_configured) {
          setAiNote('Groq is not configured, so this session will use built-in practice questions. Add GROQ_API_KEY to score answers with AI.')
        }
      })
      .catch(() => {})
  }, [])

  const [config, setConfig] = useState({
    interviewName: '',
    objectives: '',
    numQs: 5,
    duration: 60, // seconds per question
    difficulty: 'Mixed',
    mode: 'audio',
  })

  const update = (field) => (e) => setConfig({ ...config, [field]: e.target.value })

  const handleStart = async () => {
    if (!config.interviewName.trim() || !config.objectives.trim()) {
      setError('Please fill in all fields')
      return
    }

    setError('')
    setLoading(true)
    unlockInterviewAudio()

    try {
      const data = await api.generateQuestions({
        interviewName: config.interviewName,
        objectives: config.objectives,
        numQs: parseInt(config.numQs, 10),
        difficulty: config.difficulty,
      })

      if (data.questions && data.questions.length > 0) {
        navigate('/interview/live', {
          state: {
            questions: data.questions,
            source: data.source,
            notice: data.notice,
            config: {
              ...config,
              numQs: parseInt(config.numQs, 10),
              duration: parseInt(config.duration, 10),
              mode: config.mode,
            },
          },
        })
      } else {
        setError('Failed to generate questions. Try again.')
      }
    } catch (err) {
      setError(err.message || 'Could not generate questions.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="setup-page">
      <motion.div
        className="setup-container page-container medium"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="setup-header">
          <h1>Set up your interview</h1>
          <p>Configure your AI interview session</p>
        </div>

        <div className="setup-card glass-card">
          {/* Progress Steps */}
          <div className="setup-steps">
            {[1, 2].map(s => (
              <div key={s} className={`setup-step ${step >= s ? 'active' : ''} ${step > s ? 'completed' : ''}`}>
                <div className="step-dot">{step > s ? '✓' : s}</div>
                <span>{s === 1 ? 'Topic & Questions' : 'Timer & Start'}</span>
              </div>
            ))}
            <div className="step-line" style={{ width: step > 1 ? '100%' : '0%' }} />
          </div>

          {aiNote && (
            <div className="auth-error" style={{ marginBottom: '16px', background: 'rgba(245, 158, 11, 0.12)', color: 'var(--accent-amber)' }}>
              {aiNote}
            </div>
          )}

          {error && (
            <motion.div
              className="auth-error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ marginBottom: '16px' }}
            >
              {error}
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              className="setup-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="input-group">
                <label htmlFor="interviewName">
                  <FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Interview Topic
                </label>
                <input
                  id="interviewName"
                  type="text"
                  className="input-field"
                  placeholder="e.g., Java, Machine Learning, Data Structures"
                  value={config.interviewName}
                  onChange={update('interviewName')}
                />
              </div>

              <div className="input-group">
                <label htmlFor="objectives">
                  <Target size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Key Topics (comma separated)
                </label>
                <textarea
                  id="objectives"
                  className="input-field"
                  placeholder="e.g., Inheritance, Polymorphism, OOP Concepts"
                  rows={3}
                  value={config.objectives}
                  onChange={update('objectives')}
                />
              </div>

              <div className="input-group">
                <label htmlFor="difficulty">
                  <Target size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Difficulty Level
                </label>
                <div className="num-selector" style={{ marginBottom: '16px' }}>
                  {['Easy', 'Moderate', 'Tough', 'Mixed'].map(d => (
                    <button
                      key={d}
                      type="button"
                      className={`num-option ${config.difficulty === d ? 'active' : ''}`}
                      onClick={() => setConfig({ ...config, difficulty: d })}
                      style={{ padding: '8px 12px', fontSize: '0.85rem', flex: 1 }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="numQs">
                  <Sparkles size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Number of Questions
                </label>
                <div className="num-selector">
                  {[3, 5, 7, 10].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`num-option ${parseInt(config.numQs) === n ? 'active' : ''}`}
                      onClick={() => setConfig({ ...config, numQs: n })}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: '8px' }}
                onClick={() => {
                  if (!config.interviewName.trim() || !config.objectives.trim()) {
                    setError('Please fill in all fields')
                  } else {
                    setError('')
                    setStep(2)
                  }
                }}
              >
                Continue <ArrowRight size={18} />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              className="setup-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="input-group">
                <label>
                  <Target size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Interview Mode
                </label>
                <div className="time-selector">
                  <button
                    type="button"
                    className={`time-option ${config.mode === 'audio' ? 'active' : ''}`}
                    onClick={() => setConfig({ ...config, mode: 'audio' })}
                    style={{ flex: 1 }}
                  >
                    Audio & Video
                  </button>
                  <button
                    type="button"
                    className={`time-option ${config.mode === 'text' ? 'active' : ''}`}
                    onClick={() => setConfig({ ...config, mode: 'text' })}
                    style={{ flex: 1 }}
                  >
                    Text
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label>
                  <Clock size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Time Per Question (seconds)
                </label>
                <div className="time-selector">
                  {[30, 45, 60, 90, 120].map(t => (
                    <button
                      key={t}
                      type="button"
                      className={`time-option ${parseInt(config.duration) === t ? 'active' : ''}`}
                      onClick={() => setConfig({ ...config, duration: t })}
                    >
                      {t}s
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-summary">
                <h3>Interview Summary</h3>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="summary-label">Topic</span>
                    <span className="summary-value">{config.interviewName}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Questions</span>
                    <span className="summary-value">{config.numQs}</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Time/Question</span>
                    <span className="summary-value">{config.duration}s</span>
                  </div>
                  <div className="summary-item">
                    <span className="summary-label">Total Duration</span>
                    <span className="summary-value">{Math.ceil((config.numQs * config.duration) / 60)} min</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="btn btn-secondary btn-lg"
                  style={{ flex: 1 }}
                  onClick={() => setStep(1)}
                >
                  Back
                </button>
                <button
                  className={`btn btn-success btn-lg ${loading ? 'loading' : ''}`}
                  style={{ flex: 2 }}
                  onClick={handleStart}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="spinning" /> Generating Questions...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} /> Start Interview
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
