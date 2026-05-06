import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getBasePath(): string {
  if (typeof window === "undefined") return "/"
  const { pathname } = window.location
  return pathname.substring(0, pathname.lastIndexOf("/") + 1)
}

export function isInIframe(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}
