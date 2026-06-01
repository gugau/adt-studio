/**
 * Visually-hidden "Skip to main content" link that appears when focused.
 * Satisfies WCAG 2.4.1 (Bypass Blocks) — keyboard users can jump past the
 * dock (which has 6+ controls) straight to the page's `#content` instead of
 * tabbing through every toolbar button on every page load.
 *
 * Rendered first inside `ChromeRoot` so it is the very first tab stop.
 * Falls back to focusing `<main>` or `<body>` if no `#content` is present.
 */
import { useTranslation } from "@/features/language/hooks/useTranslation"

function focusMainContent(event: React.MouseEvent | React.KeyboardEvent) {
  if (typeof document === "undefined") return
  const target =
    document.getElementById("content") ??
    document.querySelector<HTMLElement>("main") ??
    document.body
  if (!target) return
  event.preventDefault()
  // Ensure the target can receive focus even if it isn't natively focusable.
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1")
  target.focus({ preventScroll: false })
  target.scrollIntoView({ block: "start", behavior: "auto" })
}

export function SkipLink() {
  const { t } = useTranslation()
  const label = t("skip-to-content") || "Skip to main content"
  return (
    <a
      href="#content"
      onClick={focusMainContent}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") focusMainContent(e)
      }}
      className="
        sr-only focus:not-sr-only
        focus:fixed focus:top-3 focus:left-1/2 focus:-translate-x-1/2
        focus:z-[100]
        focus:rounded-lg focus:px-4 focus:py-2
        focus:bg-popover focus:text-popover-foreground
        focus:shadow-lg focus:ring-2 focus:ring-ring focus:outline-none
        focus:text-sm focus:font-medium
      "
    >
      {label}
    </a>
  )
}
