/**
 * Error utilities — replaces `assets/adt/modules/error_utils.js`.
 * Toast surfaces use `sonner` (rendered by <Toaster /> from boot.tsx); the
 * legacy "create a div if #toast doesn't exist" fallback isn't needed because
 * sonner manages its own DOM.
 */
import { toast } from "sonner"

export function showErrorToast(message: string): void {
  try {
    toast.error(message, { duration: 5000 })
  } catch (err) {
    console.error("Failed to show error toast", err)
    if (typeof window !== "undefined") window.alert(message)
  }
}

export function showSuccessToast(message: string): void {
  try {
    toast.success(message, { duration: 4000 })
  } catch (err) {
    console.error("Failed to show success toast", err)
  }
}

/**
 * Maps the original error_utils.js error-classification rules into a single
 * user-facing string. Called from boot.tsx when async setup fails.
 */
export function describeInitError(error: unknown): string {
  if (error instanceof ReferenceError) {
    return "Application configuration error. Please refresh the page."
  }
  if (error instanceof TypeError) {
    return "Interface elements not found. Please check your connection."
  }
  if (error instanceof Error && error.message?.includes("fetch")) {
    return "Failed to load required components. Please check your connection."
  }
  return "Error initializing application. Some features may be unavailable."
}

/**
 * Reveals the page's `<main>` content area. The page HTML hides `#content`
 * with `opacity-0` until the runtime has finished applying translations
 * and other DOM augmentation, so this must always run on boot — even on
 * error paths.
 */
export function showMainContent(): void {
  if (typeof document === "undefined") return
  try {
    document.body.classList.remove("hidden")
    const content = document.getElementById("content")
    if (content) {
      content.classList.remove("opacity-0", "invisible", "hidden")
      content.classList.add("opacity-100", "visible")
    }
    document.querySelectorAll(".initial-hidden").forEach((el) => {
      el.classList.remove("initial-hidden", "hidden")
    })
  } catch (err) {
    console.error("Error showing main content", err)
    document.body.style.display = "block"
    document.body.style.opacity = "1"
    document.body.style.visibility = "visible"
  }
}

/**
 * Fallback timer: if something goes wrong silently and `#content` is still
 * hidden after 2s, reveal it anyway so the user sees the page.
 */
export function installShowContentFallback(): void {
  if (typeof window === "undefined") return
  setTimeout(() => {
    const content = document.getElementById("content")
    const stillHidden =
      document.body.classList.contains("hidden") ||
      (content && content.classList.contains("opacity-0"))
    if (stillHidden) {
      console.warn("ADT runtime: forcing content display after timeout")
      showMainContent()
    }
  }, 2000)
}
