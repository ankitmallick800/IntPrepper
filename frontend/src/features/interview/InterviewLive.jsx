import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Mic, Clock, ChevronRight, Volume2, Code2, ShieldAlert } from 'lucide-react'
import { api } from '../../api/client'
import { unlockInterviewAudio } from '../../lib/interviewAudio'
import { startBodyLanguage, summarizeBodyLanguage } from '../../lib/bodyLanguage'
import { useInterviewGuard } from './useInterviewGuard'
import './InterviewLive.css'

const LANGUAGES = ['Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'C#', 'Go', 'Rust', 'SQL', 'Other']

const CODING_QUESTION = [
  /\bwrite\b[\s\S]{0,48}\b(code|program|function|method|class|script|algorithm|query|sql)\b/i,
  /\bimplement\b[\s\S]{0,48}\b(function|method|class|algorithm|program|code|api|endpoint)\b/i,
  /\b(code|coding)\b[\s\S]{0,32}\b(solution|challenge|exercise|problem|this|following)\b/i,
  /\bpseudo-?code\b/i,
  /\bcomplete the (function|code|program)\b/i,
  /\bdebug (this|the) (code|function|program|snippet)\b/i,
]

function isCodingQuestion(text) {
  return CODING_QUESTION.some((pattern) => pattern.test(text || ''))
}

function formatClock(seconds) {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const remain = safe % 60
  if (minutes <= 0) return `${remain}`
  return `${minutes}:${String(remain).padStart(2, '0')}`
}

function speechFailed(text) {
  return !text
    || text.startsWith('Error')
    || text.startsWith('Could not')
    || text.startsWith('No speech detected')
}

function buildGradedAnswer({ mode, transcription, language, snippet, example, includeSnippet, includeExample, codingQuestion }) {
  const blocks = []
  const spokenOk = mode === 'text' || !speechFailed(transcription)
  if (mode === 'text') {
    const written = (transcription || '').trim()
    if (written && written !== 'No answer provided.') blocks.push(written)
  } else if (spokenOk && transcription) {
    blocks.push(transcription)
  }
  if (language) blocks.push(`Language: ${language}`)
  if ((includeSnippet || codingQuestion) && snippet.trim()) blocks.push(`Code snippet:\n${snippet.trim()}`)
  if (includeExample && example.trim()) blocks.push(`Example:\n${example.trim()}`)
  const substantive = blocks.some((part) => !part.startsWith('Language:'))
  return substantive ? blocks.join('\n\n') : ''
}

function mediaErrorMessage(err) {
  if (!window.isSecureContext) {
    return 'The browser blocks the camera and microphone on http. Use the https address for this app, accept the certificate, then allow both.'
  }
  if (err?.name === 'NotAllowedError') {
    return 'The browser blocked the camera or microphone. Click the lock icon in the address bar, set Camera and Microphone to Allow, then press the button again.'
  }
  if (err?.name === 'NotFoundError') {
    return 'No camera or microphone was found on this computer.'
  }
  return 'Camera or microphone did not start. Press Allow camera and microphone to try again.'
}

async function openDevice(constraints) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    return { stream, error: null }
  } catch (error) {
    return { stream: null, error }
  }
}

function MicWave({ stream }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !stream || stream.getAudioTracks().length === 0) return undefined

    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.82
    source.connect(analyser)
    const data = new Uint8Array(analyser.fftSize)
    let frame = 0

    const draw = () => {
      frame = requestAnimationFrame(draw)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { width, height } = canvas
      analyser.getByteTimeDomainData(data)
      let peak = 0
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = 'rgba(2, 6, 23, 0.45)'
      ctx.fillRect(0, 0, width, height)
      ctx.beginPath()
      const slice = width / data.length
      for (let i = 0; i < data.length; i += 1) {
        const value = data[i]
        peak = Math.max(peak, Math.abs(value - 128))
        const y = (value / 255) * height
        if (i === 0) ctx.moveTo(0, y)
        else ctx.lineTo(i * slice, y)
      }
      const hearing = peak > 6
      ctx.strokeStyle = hearing ? '#34d399' : 'rgba(226, 232, 240, 0.85)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.font = '600 22px sans-serif'
      ctx.fillStyle = hearing ? '#34d399' : '#e2e8f0'
      ctx.fillText(hearing ? 'Microphone is capturing' : 'Microphone is quiet — speak to see the wave move', 16, 32)
    }

    audioContext.resume().catch(() => {})
    draw()
    return () => {
      cancelAnimationFrame(frame)
      source.disconnect()
      audioContext.close().catch(() => {})
    }
  }, [stream])

  return <canvas ref={canvasRef} className="audio-waves" width={960} height={96} aria-hidden="true" />
}

export default function InterviewLive() {
  const location = useLocation()
  const navigate = useNavigate()
  const { questions, config, source, notice } = location.state || {}
  const needsMedia = config?.mode !== 'text'

  const [currentIndex, setCurrentIndex] = useState(0)
  const [limitSeconds, setLimitSeconds] = useState(config?.duration || 60)
  const [timeLeft, setTimeLeft] = useState(config?.duration || 60)
  const [codeMinutes, setCodeMinutes] = useState(5)
  const [isRecording, setIsRecording] = useState(false)
  const [results, setResults] = useState([])
  const [phase, setPhase] = useState('ready')
  const [currentFeedback, setCurrentFeedback] = useState(null)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [textAnswer, setTextAnswer] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [mediaReady, setMediaReady] = useState(!needsMedia)
  const [micStream, setMicStream] = useState(null)
  const [enabling, setEnabling] = useState(false)
  const [languageChoice, setLanguageChoice] = useState('')
  const [otherLanguage, setOtherLanguage] = useState('')
  const [chosenLanguage, setChosenLanguage] = useState('')
  const [briefingDone, setBriefingDone] = useState(false)
  const [includeSnippet, setIncludeSnippet] = useState(false)
  const [includeExample, setIncludeExample] = useState(false)
  const [snippet, setSnippet] = useState('')
  const [example, setExample] = useState('')
  const [fullscreenNote, setFullscreenNote] = useState('')

  const webcamRef = useRef(null)
  const audioStreamRef = useRef(null)
  const videoStreamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const submittingRef = useRef(false)
  const submitRef = useRef(null)
  const speechSourceRef = useRef(null)
  const speakToken = useRef(0)
  const speakRef = useRef(null)
  const enablingRef = useRef(false)
  const questionIndexRef = useRef(0)
  const bodyLogRef = useRef([])
  const bodyStatusRef = useRef(null)
  const bodyStreakRef = useRef({ code: '', count: 0 })
  const guard = useInterviewGuard(briefingDone)

  useEffect(() => {
    if (!questions || questions.length === 0) {
      navigate('/interview')
    }
  }, [questions, navigate])

  const prepareAudio = useCallback(() => unlockInterviewAudio(), [])

  const stopPlayback = useCallback(() => {
    speakToken.current += 1
    window.speechSynthesis?.cancel()
    const source = speechSourceRef.current
    speechSourceRef.current = null
    if (source) {
      try {
        source.stop()
      } catch {
        // The buffer may already have finished.
      }
    }
    setIsPlayingAudio(false)
  }, [])

  const speakQuestion = useCallback(async (text) => {
    const spoken = (text || '').trim()
    if (!spoken) return
    const ctx = prepareAudio()
    stopPlayback()
    const token = speakToken.current
    setIsPlayingAudio(true)

    const finish = () => {
      if (token === speakToken.current) setIsPlayingAudio(false)
    }

    try {
      const blob = await api.generateAudio(spoken)
      if (token !== speakToken.current) return
      if (!(blob instanceof Blob) || !ctx) throw new Error('No audio returned')
      const audioBuffer = await ctx.decodeAudioData(await blob.arrayBuffer())
      if (token !== speakToken.current) return
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)
      source.onended = finish
      speechSourceRef.current = source
      source.start()
    } catch (err) {
      console.error('ElevenLabs playback failed:', err)
      if (token !== speakToken.current) return
      if (!('speechSynthesis' in window)) {
        finish()
        return
      }
      const utterance = new SpeechSynthesisUtterance(spoken)
      utterance.rate = 0.95
      utterance.onend = finish
      utterance.onerror = finish
      window.speechSynthesis.speak(utterance)
    }
  }, [prepareAudio, stopPlayback])

  const releaseDevices = useCallback(() => {
    audioStreamRef.current?.getTracks().forEach((track) => track.stop())
    videoStreamRef.current?.getTracks().forEach((track) => track.stop())
    audioStreamRef.current = null
    videoStreamRef.current = null
    setMicStream(null)
  }, [])

  useEffect(() => {
    return () => {
      audioStreamRef.current?.getTracks().forEach((track) => track.stop())
      videoStreamRef.current?.getTracks().forEach((track) => track.stop())
      if (timerRef.current) clearInterval(timerRef.current)
      window.speechSynthesis?.cancel()
      try {
        speechSourceRef.current?.stop()
      } catch {
        // The buffer may already have finished.
      }
    }
  }, [])

  useEffect(() => {
    const video = webcamRef.current
    const stream = videoStreamRef.current
    if (!video || !stream) return
    if (video.srcObject !== stream) {
      video.srcObject = stream
      video.play?.().catch(() => {})
    }
  }, [mediaReady, phase])

  useEffect(() => {
    if (!needsMedia || !mediaReady || !briefingDone) return undefined
    const video = webcamRef.current
    const status = bodyStatusRef.current
    if (!video) return undefined

    let stop = () => {}
    let cancelled = false
    if (status) status.textContent = 'Starting body language check...'

    startBodyLanguage(video, (reading) => {
      if (status) {
        status.textContent = reading.headline
        status.classList.toggle('anomaly', !reading.ok)
      }
      const primary = reading.anomalies[0]
      if (!primary) {
        bodyStreakRef.current = { code: '', count: 0 }
        return
      }
      if (bodyStreakRef.current.code === primary.code) bodyStreakRef.current.count += 1
      else bodyStreakRef.current = { code: primary.code, count: 1 }
      if (bodyStreakRef.current.count < 2) return
      const last = bodyLogRef.current[bodyLogRef.current.length - 1]
      const now = Date.now()
      if (last && last.code === primary.code && now - last.at < 8000) return
      bodyLogRef.current.push({
        code: primary.code,
        label: primary.label,
        at: now,
        questionIndex: questionIndexRef.current,
      })
    }).then((cleanup) => {
      if (cancelled) cleanup()
      else stop = cleanup
    }).catch((error) => {
      console.error('Body language check failed:', error)
      if (status) status.textContent = 'Body language check could not start. The interview can continue.'
    })

    return () => {
      cancelled = true
      stop()
    }
  }, [briefingDone, mediaReady, needsMedia])

  useEffect(() => {
    if (phase !== 'answering') return undefined

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (guard.pausedRef.current) return prev
        if (prev <= 1) {
          clearInterval(timerRef.current)
          queueMicrotask(() => submitRef.current?.())
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [guard.pausedRef, phase, currentIndex])

  const enableDevices = useCallback(async () => {
    if (enablingRef.current) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser cannot use the camera or microphone.')
      return
    }

    enablingRef.current = true
    setEnabling(true)
    prepareAudio()
    releaseDevices()

    try {
      // Open the microphone first. Starting both devices together can hand
      // back a silent audio track, which is what made transcription empty.
      const audio = await openDevice({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      })
      const video = await openDevice({ video: { facingMode: 'user' }, audio: false })

      if (!audio.stream || !video.stream) {
        audio.stream?.getTracks().forEach((track) => track.stop())
        video.stream?.getTracks().forEach((track) => track.stop())
        setCameraError(mediaErrorMessage(audio.error || video.error))
        setMediaReady(false)
        return
      }

      audioStreamRef.current = audio.stream
      videoStreamRef.current = video.stream
      setMicStream(audio.stream)
      setCameraError('')
      setMediaReady(true)
    } finally {
      enablingRef.current = false
      setEnabling(false)
    }
  }, [prepareAudio, releaseDevices])

  const startRecording = useCallback(() => {
    const source = audioStreamRef.current
    if (!source || typeof MediaRecorder === 'undefined') {
      setCameraError('The microphone is not available, so the answer cannot be transcribed.')
      return false
    }

    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
      .find((type) => MediaRecorder.isTypeSupported(type))

    chunksRef.current = []
    let recorder
    try {
      recorder = mimeType
        ? new MediaRecorder(source, { mimeType })
        : new MediaRecorder(source)
    } catch (err) {
      console.error('Recorder error:', err)
      setCameraError('The microphone could not start recording.')
      return false
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.start(250)
    recorderRef.current = recorder
    setIsRecording(true)
    return true
  }, [])

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        resolve(null)
        return
      }
      recorder.onstop = () => {
        const type = (recorder.mimeType || 'audio/webm').split(';')[0] || 'audio/webm'
        resolve(new Blob(chunksRef.current, { type }))
      }
      if (recorder.state === 'recording') recorder.requestData()
      recorder.stop()
      setIsRecording(false)
    })
  }, [])

  const questionText = questions?.[currentIndex] || ''
  const codingQuestion = needsMedia && isCodingQuestion(questionText)

  const handleStartAnswering = () => {
    if (needsMedia && !audioStreamRef.current) return
    stopPlayback()
    submittingRef.current = false

    const minutes = Math.min(30, Math.max(1, Number(codeMinutes) || 5))
    const seconds = codingQuestion ? minutes * 60 : (config?.duration || 60)
    if (needsMedia && !startRecording()) return

    setLimitSeconds(seconds)
    setTimeLeft(seconds)
    setPhase('answering')
  }

  const handleSubmitAnswer = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    if (timerRef.current) clearInterval(timerRef.current)
    stopPlayback()
    setPhase('evaluating')

    const code = textAnswer.trim()
    const coding = needsMedia && isCodingQuestion(questions[currentIndex])
    let transcription

    if (config?.mode === 'text') {
      transcription = code || 'No answer provided.'
    } else {
      const blob = await stopRecording()
      if (blob && blob.size > 0) {
        try {
          const formData = new FormData()
          const extension = (blob.type.split('/')[1] || 'webm').split(';')[0] || 'webm'
          formData.append('audio', blob, `interview_answer.${extension}`)
          const uploadData = await api.uploadAudio(formData)
          transcription = uploadData.transcription || ''
        } catch (err) {
          console.error('Upload error:', err)
          transcription = 'Could not transcribe audio'
        }
      } else {
        transcription = 'Could not transcribe audio'
      }
    }

    const answerText = buildGradedAnswer({
      mode: config?.mode,
      transcription,
      language: chosenLanguage,
      snippet,
      example,
      includeSnippet,
      includeExample,
      codingQuestion: coding || isCodingQuestion(questions[currentIndex]),
    })

    let evaluation = { score: 0, feedback: 'No evaluation available', strengths: [], improvements: [] }

    if (!answerText) {
      evaluation = {
        score: 0,
        feedback: transcription || 'No answer was captured.',
        strengths: [],
        improvements: ['Speak so the wave moves, or type the code before the timer ends.'],
      }
    } else {
      try {
        const evalData = await api.evaluateAnswer({
          question: questions[currentIndex],
          answer: answerText,
          difficulty: config?.difficulty || 'Mixed',
        })
        if (evalData.evaluation) evaluation = evalData.evaluation
      } catch (err) {
        console.error('Evaluation error:', err)
        evaluation = {
          score: 0,
          feedback: err.message || 'Evaluation failed.',
          strengths: [],
          improvements: [],
        }
      }
    }

    const snippetOn = includeSnippet || coding || isCodingQuestion(questions[currentIndex])
    const shownAnswer = [
      transcription,
      chosenLanguage ? `Language: ${chosenLanguage}` : '',
      snippetOn && snippet.trim() ? `Code snippet:\n${snippet.trim()}` : '',
      includeExample && example.trim() ? `Example:\n${example.trim()}` : '',
    ].filter(Boolean).join('\n\n')
    const bodyNotes = [...new Set(
      bodyLogRef.current
        .filter((event) => event.questionIndex === currentIndex)
        .map((event) => event.label),
    )]
    const result = {
      question: questions[currentIndex],
      transcription: shownAnswer,
      evaluation,
      questionIndex: currentIndex,
      bodyNotes,
    }

    setResults((prev) => [...prev, result])
    setCurrentFeedback(result)
    setPhase('feedback')
  }

  useEffect(() => {
    submitRef.current = handleSubmitAnswer
    speakRef.current = speakQuestion
    questionIndexRef.current = currentIndex
  })

  const finishInterview = (finalResults) => {
    navigate('/interview/results', {
      state: {
        results: finalResults,
        config: {
          ...config,
          language: chosenLanguage,
          integrity: { ...guard.strikesRef.current },
          bodyLanguage: needsMedia
            ? summarizeBodyLanguage(bodyLogRef.current)
            : {
              total: 0,
              items: [],
              headline: 'Text mode does not use the camera, so body language was not checked.',
            },
        },
      },
    })
  }

  const beginInterview = () => {
    const name = languageChoice === 'Other' ? otherLanguage.trim() : languageChoice
    if (!name) return
    unlockInterviewAudio()
    setChosenLanguage(name)
    setBriefingDone(true)
    const request = document.documentElement.requestFullscreen?.()
    if (!request) {
      setFullscreenNote('This browser did not open full screen. Stay on this tab anyway.')
    } else {
      request.catch(() => {
        setFullscreenNote('Full screen was blocked. Stay on this tab anyway.')
      })
    }
    speakQuestion(questions[0])
  }

  const handleNext = () => {
    if (currentIndex + 1 >= questions.length) {
      const finalResults = [...results]
      if (currentFeedback && !results.find((item) => item.questionIndex === currentIndex)) {
        finalResults.push(currentFeedback)
      }
      finishInterview(finalResults)
      return
    }

    const nextIndex = currentIndex + 1
    submittingRef.current = false
    setCurrentIndex(nextIndex)
    setCurrentFeedback(null)
    setPhase('ready')
    setLimitSeconds(config?.duration || 60)
    setTimeLeft(config?.duration || 60)
    setTextAnswer('')
    setCodeMinutes(5)
    setIncludeSnippet(false)
    setIncludeExample(false)
    setSnippet('')
    setExample('')
    speakQuestion(questions[nextIndex])
  }

  if (!questions) return null

  if (needsMedia && !mediaReady) {
    return (
      <div className="live-page">
        <div className="permission-gate">
          <div className="permission-card glass-card">
            <div className="permission-icons">
              <Camera size={28} />
              <Mic size={28} />
            </div>
            <h1>Allow camera and microphone</h1>
            <p>
              The interview starts after both are on. Your camera stays on screen, and the wave
              along the bottom moves when the microphone hears you.
            </p>
            {cameraError && <p className="permission-error">{cameraError}</p>}
            <button className="btn btn-primary btn-lg" type="button" onClick={enableDevices} disabled={enabling}>
              <Camera size={18} /> {enabling ? 'Waiting for permission...' : 'Allow camera and microphone'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const languageReady = languageChoice === 'Other' ? otherLanguage.trim().length > 0 : Boolean(languageChoice)
  if (!briefingDone) {
    return (
      <div className="live-page">
        <div className="permission-gate">
          <div className="permission-card glass-card">
            <div className="permission-icons">
              <Code2 size={28} />
            </div>
            <h1>Which language are you comfortable with?</h1>
            <p>
              This choice is sent with every answer. After you continue, the interview opens in
              full screen, right-click is turned off, and leaving the tab is recorded.
            </p>
            <div className="language-grid">
              {LANGUAGES.map((language) => (
                <button
                  key={language}
                  type="button"
                  className={`language-option ${languageChoice === language ? 'active' : ''}`}
                  onClick={() => setLanguageChoice(language)}
                >
                  {language}
                </button>
              ))}
            </div>
            {languageChoice === 'Other' && (
              <input
                className="input-field language-other"
                type="text"
                placeholder="Type the language"
                value={otherLanguage}
                onChange={(event) => setOtherLanguage(event.target.value)}
              />
            )}
            <button className="btn btn-primary btn-lg" type="button" onClick={beginInterview} disabled={!languageReady}>
              Continue in full screen
            </button>
          </div>
        </div>
      </div>
    )
  }

  const progress = ((currentIndex + (phase === 'feedback' ? 1 : 0)) / questions.length) * 100
  const timerPercent = limitSeconds > 0 ? (timeLeft / limitSeconds) * 100 : 0
  const isTimeLow = limitSeconds > 60 ? timeLeft <= 30 : timeLeft <= 10

  return (
    <div className="live-page">
      <div className="live-progress-bar">
        <div className="live-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="live-layout">
        {needsMedia && (
          <div className="camera-stage">
            <video ref={webcamRef} autoPlay muted playsInline className="webcam-video" />
            <MicWave stream={micStream} />
            <p ref={bodyStatusRef} className="body-status">Watching posture and eye contact</p>
            <div className="webcam-status">
              <Camera size={12} />
              {isRecording ? (
                <>
                  <div className="rec-dot-small" />
                  <span>Live</span>
                </>
              ) : (
                <span>Camera</span>
              )}
            </div>
          </div>
        )}

        <div className="live-main">
          <div className="question-counter">
            <span className="counter-current">{currentIndex + 1}</span>
            <span className="counter-divider">/</span>
            <span className="counter-total">{questions.length}</span>
          </div>

          {source === 'fallback' && (
            <p className="live-note">
              {notice || 'These are built-in practice questions.'}
            </p>
          )}
          {cameraError && <p className="live-note">{cameraError}</p>}
          {fullscreenNote && <p className="live-note">{fullscreenNote}</p>}
          <p className="guard-note">
            Right-click is off.
            {guard.strikes.tabSwitches > 0 ? ` Tab switches recorded: ${guard.strikes.tabSwitches}.` : ''}
            {guard.strikes.fullscreenExits > 0 ? ` Full screen exits: ${guard.strikes.fullscreenExits}.` : ''}
          </p>

          <AnimatePresence mode="wait">
            {(phase === 'ready' || phase === 'answering') && (
              <motion.div
                key={`question-${currentIndex}`}
                className="question-card glass-card"
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.4 }}
              >
                <div className="question-header">
                  <span className="question-label">Question {currentIndex + 1}</span>
                  <button
                    className="btn btn-ghost play-btn"
                    type="button"
                    onClick={() => speakQuestion(questionText)}
                    disabled={isPlayingAudio}
                  >
                    <Volume2 size={16} /> {isPlayingAudio ? 'Playing...' : 'Listen'}
                  </button>
                </div>

                <h2 className="question-text">{questionText}</h2>

                {phase === 'ready' && codingQuestion && (
                  <div className="code-time-ask">
                    <label htmlFor="code-minutes">How much time do you need to write the code?</label>
                    <div className="code-time-row">
                      <input
                        id="code-minutes"
                        className="input-field"
                        type="number"
                        min={1}
                        max={30}
                        value={codeMinutes}
                        onChange={(event) => setCodeMinutes(event.target.value)}
                      />
                      <span>minutes</span>
                    </div>
                    <p>5 minutes is filled in already. Change it if you want a different limit.</p>
                  </div>
                )}

                {phase === 'answering' && config?.mode === 'text' && (
                  <div className="text-answer-section">
                    <div className={`timer-text ${isTimeLow ? 'low' : ''}`}>
                      <Clock size={14} />
                      Time left: {formatClock(timeLeft)}
                    </div>
                    <textarea
                      className="input-field"
                      rows={6}
                      placeholder="Type your answer here..."
                      value={textAnswer}
                      onChange={(event) => setTextAnswer(event.target.value)}
                    />
                  </div>
                )}

                {phase === 'answering' && needsMedia && (
                  <div className="timer-section">
                    <div className={`timer-ring ${isTimeLow ? 'low' : ''}`}>
                      <svg viewBox="0 0 100 100">
                        <circle className="timer-bg" cx="50" cy="50" r="44" />
                        <circle
                          className="timer-progress"
                          cx="50" cy="50" r="44"
                          style={{
                            strokeDasharray: `${2 * Math.PI * 44}`,
                            strokeDashoffset: `${2 * Math.PI * 44 * (1 - timerPercent / 100)}`,
                          }}
                        />
                      </svg>
                      <span className={`timer-value ${isTimeLow ? 'low' : ''}`}>{formatClock(timeLeft)}</span>
                    </div>
                    <div className="recording-indicator">
                      <div className="rec-dot" />
                      <span>Recording</span>
                    </div>
                  </div>
                )}

                <div className="question-actions">
                  {phase === 'ready' && (
                    <button className="btn btn-primary btn-lg" type="button" onClick={handleStartAnswering}>
                      <Mic size={18} /> {config?.mode === 'text' ? 'Start Writing' : codingQuestion ? 'Start coding' : 'Start Answering'}
                    </button>
                  )}
                  {phase === 'answering' && (
                    <button className="btn btn-success btn-lg" type="button" onClick={handleSubmitAnswer}>
                      <ChevronRight size={18} /> Submit Answer
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {phase === 'evaluating' && (
              <motion.div
                key="evaluating"
                className="evaluating-card glass-card"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="evaluating-content">
                  <div className="evaluating-spinner" />
                  <h3>Reviewing your answer...</h3>
                  <p>{config?.mode === 'text' ? 'Scoring what you wrote.' : 'Transcribing your recording and scoring the answer.'}</p>
                </div>
              </motion.div>
            )}

            {phase === 'feedback' && currentFeedback && (
              <motion.div
                key="feedback"
                className="feedback-card glass-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="feedback-score-section">
                  <div className={`feedback-score ${currentFeedback.evaluation.score >= 7 ? 'high'
                    : currentFeedback.evaluation.score >= 4 ? 'mid' : 'low'}`}
                  >
                    <span className="score-value">{currentFeedback.evaluation.score}</span>
                    <span className="score-max">/10</span>
                  </div>
                </div>

                <p className="feedback-text">{currentFeedback.evaluation.feedback}</p>

                {currentFeedback.transcription && (
                  <div className="feedback-transcript">
                    <h4>Your Answer:</h4>
                    <p>{currentFeedback.transcription}</p>
                  </div>
                )}

                {currentFeedback.bodyNotes?.length > 0 && (
                  <div className="feedback-list improvements">
                    <h4>Body language during this answer</h4>
                    {currentFeedback.bodyNotes.map((note) => (
                      <p key={note}>• {note}</p>
                    ))}
                  </div>
                )}

                {currentFeedback.evaluation.strengths?.length > 0 && (
                  <div className="feedback-list strengths">
                    <h4>Strengths</h4>
                    {currentFeedback.evaluation.strengths.map((item, index) => (
                      <p key={`${item}-${index}`}>• {item}</p>
                    ))}
                  </div>
                )}

                {currentFeedback.evaluation.improvements?.length > 0 && (
                  <div className="feedback-list improvements">
                    <h4>Areas to Improve</h4>
                    {currentFeedback.evaluation.improvements.map((item, index) => (
                      <p key={`${item}-${index}`}>• {item}</p>
                    ))}
                  </div>
                )}

                <button className="btn btn-primary btn-lg next-btn" type="button" onClick={handleNext}>
                  {currentIndex + 1 >= questions.length ? (
                    <>View Results <ChevronRight size={18} /></>
                  ) : (
                    <>Next Question <ChevronRight size={18} /></>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {(phase === 'ready' || phase === 'answering') && (
            <section className="coding-section glass-card">
              <div className="coding-section-header">
                <h3><Code2 size={18} /> Coding</h3>
                <span className="language-pill">{chosenLanguage}</span>
              </div>
              <p className="coding-help">
                Check a box to add that part. It is submitted with your answer and scored with it.
              </p>
              <label className="coding-check">
                <input
                  type="checkbox"
                  checked={includeSnippet || codingQuestion}
                  disabled={codingQuestion}
                  onChange={(event) => setIncludeSnippet(event.target.checked)}
                />
                Code snippet
              </label>
              {(includeSnippet || codingQuestion) && (
                <textarea
                  className="input-field code-input"
                  rows={10}
                  spellCheck={false}
                  placeholder="Write or paste the code you want reviewed"
                  value={snippet}
                  onChange={(event) => setSnippet(event.target.value)}
                />
              )}
              {codingQuestion && (
                <p className="coding-help">This question asks for code, so the snippet box stays open.</p>
              )}
              <label className="coding-check">
                <input
                  type="checkbox"
                  checked={includeExample}
                  onChange={(event) => setIncludeExample(event.target.checked)}
                />
                Example
              </label>
              {includeExample && (
                <textarea
                  className="input-field code-input"
                  rows={6}
                  spellCheck={false}
                  placeholder="Add an input, output, or a short walkthrough"
                  value={example}
                  onChange={(event) => setExample(event.target.value)}
                />
              )}
            </section>
          )}
        </div>
      </div>

      {guard.warning && (
        <div className="guard-overlay">
          <div className="guard-card glass-card">
            <ShieldAlert size={28} />
            <h2>{guard.warning === 'tab' ? 'You left the interview tab' : 'Full screen was closed'}</h2>
            <p>
              {guard.warning === 'tab'
                ? 'Switching tabs is recorded. Come back to the interview to continue. The timer is paused.'
                : 'The interview stays in full screen. Returning is recorded as a full screen exit. The timer is paused.'}
            </p>
            {guard.warning === 'fullscreen' ? (
              <button className="btn btn-primary btn-lg" type="button" onClick={guard.returnToFullscreen}>
                Return to full screen
              </button>
            ) : (
              <button className="btn btn-primary btn-lg" type="button" onClick={guard.resume}>
                Continue the interview
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
