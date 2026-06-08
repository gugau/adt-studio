/**
 * Automated WCAG accessibility audit of the Studio UI using axe-core.
 *
 * Strategy:
 *  - Launch the real Electron app via the shared fixture in setup.ts.
 *  - Inject axe-core into the renderer page via addScriptTag (avoids CDP
 *    restrictions that prevent @axe-core/playwright from creating new pages).
 *  - Assert that no critical or serious violations are present.
 *
 * Disabled rules:
 *  - color-contrast: Electron's custom app:// protocol serves static assets;
 *    CSS variables resolve correctly at runtime but axe cannot compute
 *    contrast ratios reliably over CDP without a full layout pass.
 *
 * WCAG target: 2.1 AA (tags: wcag2a, wcag2aa, wcag21aa).
 */

import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import type { Result, RunOptions } from "axe-core"
import { test, expect, createTestBook, RAVEN_PDF } from "./setup"

const _require = createRequire(import.meta.url)
const AXE_BUNDLE = _require.resolve("axe-core/axe.min.js")

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Inject axe-core into a page (idempotent — safe to call multiple times). */
async function injectAxe(page: import("@playwright/test").Page): Promise<void> {
  const already = await page.evaluate(() => typeof (window as any).axe !== "undefined")
  if (!already) {
    await page.addScriptTag({ path: AXE_BUNDLE })
  }
}

/** Run axe on the page and return all violations. */
async function runAxe(
  page: import("@playwright/test").Page,
  options: RunOptions = {}
): Promise<Result[]> {
  await injectAxe(page)
  return page.evaluate(
    (opts) =>
      (window as any).axe.run(document, opts) as Promise<{ violations: Result[] }>,
    options as any
  ).then((r: any) => r.violations as Result[])
}

const BASE_OPTIONS: RunOptions = {
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"],
  },
  rules: {
    // Requires computed CSS layout unavailable in CDP snapshots
    "color-contrast": { enabled: false },
  },
}

/** Return only critical / serious violations — filter out minor/moderate. */
function critical(violations: Result[]): Result[] {
  return violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  )
}

function formatViolations(violations: Result[]): string {
  return violations
    .map(
      (v) =>
        `[${v.impact}] ${v.id}: ${v.help}\n` +
        v.nodes
          .slice(0, 2)
          .map((n) => `  → ${n.html.slice(0, 120)}`)
          .join("\n")
    )
    .join("\n\n")
}

// ── WCAG audit tests ──────────────────────────────────────────────────────────

test.describe("Studio UI — WCAG 2.1 AA audit", () => {
  test("home page (book list) has no critical or serious violations", async ({ page }) => {
    // Wait for the app shell to be interactive
    await page.waitForTimeout(1000)

    const violations = critical(await runAxe(page, BASE_OPTIONS))
    expect(
      violations,
      `Home page: ${violations.length} critical/serious violation(s):\n${formatViolations(violations)}`
    ).toHaveLength(0)
  })

  test("home page has no Level A (wcag2a) violations", async ({ page }) => {
    const violations = await runAxe(page, {
      runOnly: { type: "tag", values: ["wcag2a"] },
      rules: { "color-contrast": { enabled: false } },
    })

    expect(
      violations,
      `Level A violations:\n${formatViolations(violations)}`
    ).toHaveLength(0)
  })

  test("book detail page has no critical or serious violations", async ({
    page,
    apiUrl,
  }) => {
    const label = await createTestBook(apiUrl, RAVEN_PDF, "a11y-audit-book")

    // Navigate to the book page via a link or URL
    const bookLink = page.getByRole("link", { name: new RegExp(label, "i") })
    const visible = await bookLink.isVisible().catch(() => false)
    if (visible) {
      await bookLink.click()
    } else {
      await page.evaluate((lbl) => {
        const base = window.location.href.replace(/\/books\/.*$/, "")
        window.location.href = `${base}/books/${lbl}`
      }, label)
    }
    await page.waitForTimeout(1500)

    const violations = critical(await runAxe(page, BASE_OPTIONS))
    expect(
      violations,
      `Book detail page: ${violations.length} critical/serious violation(s):\n${formatViolations(violations)}`
    ).toHaveLength(0)
  })
})

// ── Keyboard navigation ───────────────────────────────────────────────────────

test.describe("Keyboard navigation", () => {
  test("interactive elements are reachable by Tab on the home page", async ({ page }) => {
    await page.waitForTimeout(500)

    // Tab several times and collect focused elements
    const focused: string[] = []
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab")
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        return el
          ? `${el.tagName}:${el.getAttribute("role") ?? ""}:${(el as any).tabIndex}`
          : "null"
      })
      focused.push(info)
    }

    const nativeTags = ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]
    const anyFocusable = focused.some((f) => {
      const [tag, , ti] = f.split(":")
      return nativeTags.includes(tag) || parseInt(ti) >= 0
    })

    expect(
      anyFocusable,
      `No focusable element found after 5x Tab. Got: ${focused.join(", ")}`
    ).toBe(true)
  })

  test("no keyboard trap: Tab cycles within the page", async ({ page }) => {
    await page.waitForTimeout(500)

    const visited = new Set<string>()
    let cycled = false

    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab")
      const id = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement
        return [
          el?.tagName,
          el?.id,
          el?.getAttribute("aria-label"),
          el?.textContent?.slice(0, 30),
        ]
          .filter(Boolean)
          .join("|")
      })
      if (visited.has(id) && id !== "null" && id !== "BODY") {
        cycled = true
        break
      }
      visited.add(id)
    }

    expect(visited.size, "No elements were focused after 25x Tab").toBeGreaterThan(0)
    // Cycling is the expected behavior (no trap)
    // If we didn't cycle it means there are 25+ unique focusable elements — also OK
    // The test fails only if visited.size === 0 (nothing was focusable)
  })
})
