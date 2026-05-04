import { Trans } from "@lingui/react/macro"
import { STUCK_THRESHOLD_SECONDS } from "../constants"

function StatusMessage({ elapsed }: { elapsed: number }) {
  if (elapsed < 4) {
    return <Trans>Starting</Trans>
  }
  if (elapsed < STUCK_THRESHOLD_SECONDS) {
    return <Trans>Almost there</Trans>
  }
  return <Trans>Taking longer than usual</Trans>
}

export { StatusMessage }
