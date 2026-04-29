import { useEffect, useState } from "react"

function useElapsedSeconds() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [])
  return seconds
}

export { useElapsedSeconds }
