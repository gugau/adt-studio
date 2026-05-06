import { Trans, useLingui } from "@lingui/react/macro"
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  RefreshCw,
} from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAppVersion } from "@/hooks/use-app-version"
import { useUpdateStatus, type UpdateStatus } from "@/hooks/use-update-status"
import { formatBytes, cn } from "@/lib/utils"

export interface UpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UpdateDialog({ open, onOpenChange }: UpdateDialogProps) {
  const { t } = useLingui()
  const currentVersion = useAppVersion()
  const { status, check, download, install, installOnQuit } = useUpdateStatus()

  const targetVersion = getTargetVersion(status)
  const totalBytes = getTotalBytes(status)
  const releaseNotes = getReleaseNotes(status)
  const releaseDate = status.phase === "available" ? status.releaseDate : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] gap-5">
        <DialogHeader>
          <DialogTitle>
            <Trans>Software Update</Trans>
          </DialogTitle>
          <DialogDescription className="sr-only">
            <Trans>Software update status</Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <Field label={t`Current version`} value={currentVersion ?? "—"} />
          <Field label={t`New version`} value={targetVersion ?? "—"} />
          <Field
            label={t`Download size`}
            value={totalBytes ? formatBytes(totalBytes) : "—"}
          />
        </div>

        {(releaseDate || releaseNotes) && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">
              <Trans>What's new</Trans>
            </h3>
            {targetVersion && (
              <div className="text-sm">
                <div className="font-medium">
                  <Trans>Version {targetVersion}</Trans>
                </div>
                {releaseDate && (
                  <div className="text-xs text-muted-foreground">
                    {formatReleaseDate(releaseDate)}
                  </div>
                )}
              </div>
            )}
            {releaseNotes && <ReleaseNotes html={releaseNotes} />}
          </div>
        )}

        <StatusFooter
          status={status}
          onCheck={check}
          onDownload={download}
          onInstallNow={install}
          onInstallLater={async () => {
            await installOnQuit()
            onOpenChange(false)
          }}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 tabular-nums">{value}</div>
    </div>
  )
}

function ReleaseNotes({ html }: { html: string }) {
  const trimmed = html.trim()
  if (!trimmed) return null

  // Strip HTML for safe rendering — release notes come from GitHub releases
  // and may include markup we don't want to render verbatim.
  const text = trimmed
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!text) return null

  return (
    <div className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
      {text}
    </div>
  )
}

interface StatusFooterProps {
  status: UpdateStatus
  onCheck: () => void
  onDownload: () => void
  onInstallNow: () => void
  onInstallLater: () => void
  onClose: () => void
}

function StatusFooter({
  status,
  onCheck,
  onDownload,
  onInstallNow,
  onInstallLater,
  onClose,
}: StatusFooterProps) {
  if (status.phase === "available") {
    return (
      <Footer
        message={
          <FooterMessage
            icon={<Info className="size-4 text-blue-500" />}
            label={<Trans>A new version is available for download.</Trans>}
          />
        }
        actions={
          <>
            <Button variant="outline" onClick={onClose}>
              <Trans>Skip for now</Trans>
            </Button>
            <Button onClick={onDownload}>
              <Download className="size-4" />
              <Trans>Download update</Trans>
            </Button>
          </>
        }
      />
    )
  }

  if (status.phase === "downloading") {
    const percent = Math.max(0, Math.min(100, status.percent))
    return (
      <Footer
        message={
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <Download className="size-4 text-blue-500" />
              <span>
                <Trans>
                  Downloading… {Math.round(percent)}% ·{" "}
                  {formatBytes(status.bytesPerSecond)}/s
                </Trans>
              </span>
            </div>
            <ProgressBar percent={percent} />
            <div className="text-xs text-muted-foreground tabular-nums">
              {formatBytes(status.transferred)} / {formatBytes(status.total)}
            </div>
          </div>
        }
        actions={
          <Button variant="outline" onClick={onClose}>
            <Trans>Hide</Trans>
          </Button>
        }
      />
    )
  }

  if (status.phase === "downloaded") {
    return (
      <Footer
        message={
          <FooterMessage
            icon={<CheckCircle2 className="size-4 text-emerald-500" />}
            label={<Trans>Update downloaded. Restart to install.</Trans>}
          />
        }
        actions={
          <>
            <Button variant="outline" onClick={onInstallLater}>
              <Trans>Install on quit</Trans>
            </Button>
            <Button onClick={onInstallNow}>
              <Trans>Restart and install</Trans>
            </Button>
          </>
        }
      />
    )
  }

  if (status.phase === "checking") {
    return (
      <Footer
        message={
          <FooterMessage
            icon={
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            }
            label={<Trans>Checking for updates…</Trans>}
          />
        }
      />
    )
  }

  if (status.phase === "error") {
    return (
      <Footer
        message={
          <FooterMessage
            icon={<AlertCircle className="size-4 text-destructive" />}
            label={status.message}
          />
        }
        actions={
          <>
            <Button onClick={onCheck}>
              <RefreshCw className="size-4" />
              <Trans>Try again</Trans>
            </Button>
          </>
        }
      />
    )
  }

  return (
    <Footer
      message={
        <FooterMessage
          icon={<CheckCircle2 className="size-4 text-emerald-500" />}
          label={
            <Trans>Your app is up to date. There's nothing to do.</Trans>
          }
        />
      }
      actions={
        <>
          <Button onClick={onCheck}>
            <RefreshCw className="size-4" />
            <Trans>Check for updates</Trans>
          </Button>
        </>
      }
    />
  )
}

function Footer({
  message,
  actions,
}: {
  message: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className={cn("min-w-0 flex-1", !message && "hidden sm:block")}>
        {message}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-2">
        {actions}
      </div>
    </div>
  )
}

function FooterMessage({
  icon,
  label,
}: {
  icon: ReactNode
  label: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
  )
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width] duration-150"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

function getTargetVersion(status: UpdateStatus): string | undefined {
  switch (status.phase) {
    case "available":
    case "downloading":
    case "downloaded":
      return status.version
    default:
      return undefined
  }
}

function getTotalBytes(status: UpdateStatus): number | undefined {
  switch (status.phase) {
    case "available":
      return status.totalBytes
    case "downloading":
      return status.total
    default:
      return undefined
  }
}

function getReleaseNotes(status: UpdateStatus): string | undefined {
  switch (status.phase) {
    case "available":
    case "downloaded":
      return status.releaseNotes
    default:
      return undefined
  }
}

function formatReleaseDate(value: string): string {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return value
  return new Date(parsed).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}
