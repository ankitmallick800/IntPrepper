import { useEffect, useRef, useState } from 'react'

const EMPTY_STRIKES = { tabSwitches: 0, fullscreenExits: 0, rightClicks: 0 }

export function useInterviewGuard(active) {
  const [warning, setWarning] = useState(null)
  const [strikes, setStrikes] = useState(EMPTY_STRIKES)
  const strikesRef = useRef({ ...EMPTY_STRIKES })
  const pausedRef = useRef(false)

  useEffect(() => {
    if (!active) return undefined

    const remember = (next) => {
      strikesRef.current = next
      setStrikes(next)
    }

    const blockMenu = (event) => {
      event.preventDefault()
      remember({ ...strikesRef.current, rightClicks: strikesRef.current.rightClicks + 1 })
    }

    const onVisibility = () => {
      if (!document.hidden) return
      pausedRef.current = true
      remember({ ...strikesRef.current, tabSwitches: strikesRef.current.tabSwitches + 1 })
      setWarning('tab')
    }

    const onFullscreen = () => {
      if (document.fullscreenElement) return
      pausedRef.current = true
      remember({ ...strikesRef.current, fullscreenExits: strikesRef.current.fullscreenExits + 1 })
      setWarning('fullscreen')
    }

    const onLeave = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    document.addEventListener('contextmenu', blockMenu)
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('fullscreenchange', onFullscreen)
    window.addEventListener('beforeunload', onLeave)

    return () => {
      document.removeEventListener('contextmenu', blockMenu)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('fullscreenchange', onFullscreen)
      window.removeEventListener('beforeunload', onLeave)
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {})
      }
    }
  }, [active])

  const resume = () => {
    pausedRef.current = false
    setWarning(null)
  }

  const returnToFullscreen = () => {
    const request = document.documentElement.requestFullscreen?.()
    if (!request) {
      resume()
      return
    }
    request.then(resume).catch(resume)
  }

  return { warning, strikes, strikesRef, pausedRef, resume, returnToFullscreen }
}
