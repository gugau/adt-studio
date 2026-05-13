/**
 * Matomo analytics — port of `assets/adt/modules/analytics.js`.
 *
 * Driven by `config.analytics` from `assets/config.json`. When disabled
 * (the common case for previews), `initAnalytics` is a no-op.
 */
import type { AppAnalytics } from "@/shared/state/config.atoms"

declare global {
  interface Window {
    _paq?: unknown[]
  }
}

let initialized = false

export function initAnalytics(config: AppAnalytics | undefined): void {
  if (!config?.enabled || initialized) return
  if (typeof window === "undefined") return

  initialized = true
  window._paq = window._paq ?? []
  window._paq.push(["trackPageView"])
  window._paq.push(["enableLinkTracking"])
  if (config.trackerUrl) window._paq.push(["setTrackerUrl", config.trackerUrl])
  if (config.siteId !== undefined) window._paq.push(["setSiteId", config.siteId])

  if (config.srcUrl) {
    const script = document.createElement("script")
    script.type = "text/javascript"
    script.async = true
    script.defer = true
    script.src = config.srcUrl
    document.head.appendChild(script)
  }
}

function track(action: unknown[]): void {
  if (typeof window === "undefined") return
  if (!window._paq) {
    if (initialized) console.warn("Matomo not ready, dropping event")
    return
  }
  window._paq.push(action)
}

export function trackEvent(
  category: string,
  action: string,
  name: string | null = null,
  value: number | null = null,
): void {
  track(["trackEvent", category, action, name, value])
}

export function trackActivityCompletion(
  activityId: string,
  activityType: string,
  score: number | null = null,
): void {
  trackEvent("Activity", "Completion", `${activityType}: ${activityId}`, score)
}

export function trackNavigation(fromPage: string, toPage: string): void {
  trackEvent("Navigation", "PageChange", `${fromPage} → ${toPage}`)
}

export function trackTimeSpent(activityId: string, seconds: number): void {
  trackEvent("Activity", "TimeSpent", activityId, Math.round(seconds))
}

export function trackFormSubmission(formId: string, isComplete: boolean): void {
  trackEvent("Form", "Submission", formId, isComplete ? 1 : 0)
}

export function trackToggleEvent(toggleName: string, isActive: boolean): void {
  trackEvent("Toggle", isActive ? "Activated" : "Deactivated", toggleName)
}
