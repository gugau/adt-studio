import { useEffect, useState } from "react"
import { STUCK_THRESHOLD_SECONDS } from "../constants"


function useUpdateStatus(elapsed: number) {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const isUpdating =
    status?.phase === "checking" ||
    status?.phase === "available" ||
    status?.phase === "downloading" ||
    status?.phase === "downloaded"
  const isStuck = !isUpdating && elapsed >= STUCK_THRESHOLD_SECONDS
  const downloadPercent =
    status?.phase === "downloading" ? Math.max(0, Math.min(100, status.percent)) : null

  useEffect(() => {
    const api = window.splashControls
    if (!api) return

    let cancelled = false
    api.getUpdateStatus().then((initial) => {
      if (!cancelled && initial) setStatus(initial)
    })

    const unsubscribe = api.onUpdateStatus((next) => setStatus(next))

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return { isUpdating, isStuck, downloadPercent, status }
}

export { useUpdateStatus, }
