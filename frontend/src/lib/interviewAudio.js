let audioContext = null

export function unlockInterviewAudio() {
  const Context = window.AudioContext || window.webkitAudioContext
  if (!Context) return null
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new Context()
  }
  audioContext.resume().catch(() => {})
  return audioContext
}
