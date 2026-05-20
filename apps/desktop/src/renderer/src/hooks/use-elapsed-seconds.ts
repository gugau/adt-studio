import { useEffect, useState } from "react"

// Module-level so the elapsed counter survives route changes — a tab
// switch to `/debug` and back unmounts SplashView, but the wall-clock
// reference here doesn't change.
const startedAt = Date.now()

function readElapsed(): number {
  return Math.floor((Date.now() - startedAt) / 1000)
}

function useElapsedSeconds() {
  const [seconds, setSeconds] = useState(readElapsed)
  useEffect(() => {
    setSeconds(readElapsed())
    const id = window.setInterval(() => setSeconds(readElapsed()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return seconds
}

export { useElapsedSeconds }
