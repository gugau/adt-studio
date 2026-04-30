import { Trans } from "@lingui/react/macro"
import { STUCK_THRESHOLD_SECONDS } from "../constants"

function StatusMessage({
  elapsed,
  update,
}: {
  elapsed: number
  update: UpdateStatus | null
}) {
  if (update?.phase === "checking") {
    return <Trans>Checking for updates</Trans>
  }
  if (update?.phase === "available") {
    return <Trans>Update available</Trans>
  }
  if (update?.phase === "downloading") {
    return <Trans>Downloading update {Math.round(update.percent)}%</Trans>
  }
  if (update?.phase === "downloaded") {
    return <Trans>Installing update</Trans>
  }

  if (elapsed < 4) {
    return <Trans>Starting</Trans>
  }
  if (elapsed < STUCK_THRESHOLD_SECONDS) {
    return <Trans>Almost there</Trans>
  }
  return <Trans>Taking longer than usual</Trans>
}

export { StatusMessage }
