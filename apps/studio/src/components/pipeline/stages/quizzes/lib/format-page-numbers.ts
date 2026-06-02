/**
 * Format a set of page numbers into a compact human label.
 * Consecutive runs collapse to a range ("3–5"); gaps are comma-separated
 * ("3, 5, 8"). Returns an empty string when there are no numbers.
 */
export function formatPageNumbers(nums: number[]): string {
  if (nums.length === 0) return ""
  const sorted = [...nums].sort((a, b) => a - b)
  if (sorted.length === 1) return String(sorted[0])
  const consecutive = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1)
  if (consecutive) return `${sorted[0]}–${sorted[sorted.length - 1]}`
  return sorted.join(", ")
}
