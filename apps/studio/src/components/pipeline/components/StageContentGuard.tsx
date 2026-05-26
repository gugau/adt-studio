import type { ReactNode } from "react"
import { LoadingState, type StageSlug } from "./LoadingState"

interface StageContentGuardProps {
  isLoading: boolean
  loadingLabel: ReactNode
  showRunCard: boolean
  runCard: ReactNode
  children: ReactNode
  stageSlug?: StageSlug
}

export function StageContentGuard({
  isLoading,
  loadingLabel,
  showRunCard,
  runCard,
  children,
  stageSlug,
}: StageContentGuardProps) {
  if (isLoading) {
    return <LoadingState variant="stage" label={loadingLabel} stageSlug={stageSlug} />
  }
  if (showRunCard) {
    return <div className="p-4">{runCard}</div>
  }
  return <>{children}</>
}
