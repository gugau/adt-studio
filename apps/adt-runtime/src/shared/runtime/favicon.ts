/**
 * Idempotently injects favicons into <head>. Direct port of `addFavicons()`
 * from base.js — every page bundles its own <head> minus favicons, so the
 * runtime adds them once on boot.
 */
const LINKS = [
  { rel: "icon", type: "image/x-icon", href: "./assets/favicon_io/favicon.ico" },
  {
    rel: "apple-touch-icon",
    sizes: "180x180",
    href: "./assets/favicon_io/apple-touch-icon.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "32x32",
    href: "./assets/favicon_io/favicon-32x32.png",
  },
  {
    rel: "icon",
    type: "image/png",
    sizes: "16x16",
    href: "./assets/favicon_io/favicon-16x16.png",
  },
  { rel: "manifest", href: "./assets/favicon_io/site.webmanifest" },
] as const

export function addFavicons(): void {
  if (typeof document === "undefined") return
  const head = document.head
  const existing = Array.from(head.querySelectorAll("link"))
  for (const data of LINKS) {
    const fileName = data.href.split("/").pop() ?? ""
    const already = existing.some(
      (link) => link.rel === data.rel && link.href.includes(fileName),
    )
    if (already) continue
    const link = document.createElement("link")
    for (const [attr, value] of Object.entries(data)) link.setAttribute(attr, value)
    head.appendChild(link)
  }
}
