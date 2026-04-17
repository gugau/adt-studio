import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function BrowserChrome({
  url,
  children,
  className,
}: {
  url: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex flex-1 justify-center">
          <div className="flex items-center gap-1.5 rounded-md bg-background/70 px-3 py-1 text-[11px] text-muted-foreground">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M3.5 5.5V4a2.5 2.5 0 1 1 5 0v1.5M3 5.5h6v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {url}
          </div>
        </div>
        <div className="w-[60px]" />
      </div>
      <div className="relative h-[480px] overflow-hidden">{children}</div>
    </div>
  )
}
