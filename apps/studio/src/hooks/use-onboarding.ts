const STORAGE_KEY = "adt-studio-onboarding-completed"

export function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function markOnboardingCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1")
  } catch {
    // localStorage unavailable
  }
}
