import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import fs from "node:fs"
import path from "node:path"

/**
 * Dev preview wires the runtime against a self-contained sample book that
 * lives inside this package at `apps/adt-runtime/sample/`.
 *
 * The sample is a copy of a real packaged book — same structure as
 * `books/<book>/adt/`. Vite serves it as the dev webroot, so every URL
 * the runtime expects (`/assets/...`, `/content/...`, `/images/...`)
 * resolves locally with no API or proxy. TTS audio, glossary catalogs,
 * navigation manifests, every i18n locale — all there.
 *
 * The only mismatch with production: the sample's HTML pages were built
 * to load `./assets/base.bundle.local.js` (the previous build's bundle).
 * `bookHtmlPlugin` intercepts every `*.html` request, strips that script
 * tag, and injects Vite's HMR client + `/src/boot.tsx`. The transformed
 * HTML is then run through `server.transformIndexHtml(...)` so plugins
 * like @vitejs/plugin-react get to inject their HMR preamble too.
 *
 * Refresh / swap the sample with `pnpm sample:sync [book-label]`.
 */
const PREVIEW_PAGE = process.env.ADT_PREVIEW_PAGE ?? "pg004005_sec001"
const sampleDir = path.resolve(__dirname, "sample")
const sampleExists = fs.existsSync(sampleDir) && fs.existsSync(path.join(sampleDir, "index.html"))

if (!sampleExists) {
  console.warn(
    `\n[adt-runtime] ⚠ Sample directory not found: ${sampleDir}\n` +
      `[adt-runtime]   Dev preview will fall back to the static index.html shell.\n` +
      `[adt-runtime]   Populate it once with:  pnpm sample:sync [book-label]\n` +
      `[adt-runtime]   (default label: pinheiros-jsx)\n`,
  )
}

function bookHtmlPlugin(): Plugin {
  return {
    name: "adt-runtime-dev-book-html",
    apply: "serve",
    configureServer(server) {
      if (!sampleExists) return
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next()
        const url = req.url.split("?")[0]
        const pagePath = resolveBookPage(url)
        if (!pagePath) return next()
        try {
          const raw = fs.readFileSync(pagePath, "utf-8")
          const withRuntime = injectDevRuntime(raw)
          // Run through Vite's transformIndexHtml so all plugins (notably
          // @vitejs/plugin-react) get to inject their HMR preamble. Without
          // this React Refresh bails with "can't detect preamble".
          const transformed = await server.transformIndexHtml(req.url, withRuntime)
          res.setHeader("Content-Type", "text/html; charset=utf-8")
          res.setHeader("Cache-Control", "no-cache")
          res.end(transformed)
        } catch (err) {
          console.error("[adt-runtime] dev book serve failed:", err)
          next(err as Error)
        }
      })
    },
  }
}

/**
 * Map a request URL to a real sample HTML file on disk, or null when none
 * matches. Restricts to `sampleDir` so we don't accidentally serve files
 * elsewhere on the file system.
 */
function resolveBookPage(url: string): string | null {
  if (url === "/" || url === "/index.html") {
    const preferred = path.join(sampleDir, `${PREVIEW_PAGE}.html`)
    if (fs.existsSync(preferred)) return preferred
    const fallback = path.join(sampleDir, "index.html")
    return fs.existsSync(fallback) ? fallback : null
  }
  if (/^\/[A-Za-z0-9_.-]+\.html$/.test(url)) {
    const target = path.join(sampleDir, url.slice(1))
    const resolved = path.resolve(target)
    if (resolved.startsWith(path.resolve(sampleDir)) && fs.existsSync(resolved)) {
      return resolved
    }
  }
  return null
}

/**
 * Strip the production bundle's scripts from the page HTML and inject
 * Vite's dev module + HMR client. boot.tsx runs from /src and imports
 * globals.css — Vite's React + Tailwind plugins handle both.
 */
function injectDevRuntime(html: string): string {
  let out = html.replace(
    /\s*<script[^>]+src="\.\/assets\/(?:offline-preloader|scorm|base\.bundle\.local|base\.bundle\.min)\.js[^"]*"[^>]*><\/script>/g,
    "",
  )
  out = out.replace(
    /<\/body>/,
    `\n    <script type="module" src="/@vite/client"></script>\n    <script type="module" src="/src/boot.tsx"></script>\n  </body>`,
  )
  return out
}

export default defineConfig({
  plugins: [react(), tailwindcss(), bookHtmlPlugin()],
  // Serve the sample book as the dev webroot. Falls back to the local
  // `public/` shell when the sample hasn't been synced yet.
  publicDir: sampleExists ? sampleDir : path.resolve(__dirname, "public"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    fs: {
      allow: [
        path.resolve(__dirname, ".."),
        path.resolve(__dirname, "../.."),
      ],
    },
  },
})
