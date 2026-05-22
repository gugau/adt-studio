/* eslint-disable lingui/no-unlocalized-strings -- CSS var tokens, not user-visible */

/**
 * Resolves to the active stage's accent color, falling back to a neutral gray
 * when no LandingPageShell is in the cascade. Use in inline `style` objects
 * for colors that need to track the stage hue (borders, fills, text accents).
 */
export const ACCENT_VAR = `var(--accent-color, #525252)`

/**
 * Lighter variant for muted accent tints (e.g., card backgrounds, hover bgs).
 * Falls back to a neutral light-gray when the shell hasn't set the soft var.
 */
export const ACCENT_VAR_SOFT = `var(--accent-color-soft, #f5f5f5)`

/**
 * Muted accent for arrow icons, subtle indicators. Falls back to neutral
 * mid-gray.
 */
export const ACCENT_VAR_LIGHT = `var(--accent-color, #a3a3a3)`
