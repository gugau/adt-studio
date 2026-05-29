import { type Plugin } from "vite"
import fs from "node:fs"
import path from "node:path"

const PREVIEW_PAGE = process.env.ADT_PREVIEW_PAGE ?? "index"
const PREVIEW_BOOK = process.env.ADT_PREVIEW_BOOK
const booksRoot = path.resolve(__dirname, "../../books")

function listBooks(): string[] {
  if (!fs.existsSync(booksRoot)) return []
  return fs
    .readdirSync(booksRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(booksRoot, name, "adt", "index.html")))
    .sort((a, b) => a.localeCompare(b))
}

function bookAdtDir(label: string): string {
  return path.join(booksRoot, label, "adt")
}

function bookDefaultPage(label: string): string {
  const adtDir = bookAdtDir(label)
  const preferred = path.join(adtDir, `${PREVIEW_PAGE}.html`)
  if (fs.existsSync(preferred)) return `${PREVIEW_PAGE}.html`
  return "index.html"
}

const STATIC_MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".html": "text/html; charset=utf-8",
}

function chooserHtml(books: string[]): string {
  const items = books
    .map(
      (b) =>
        `<li><a href="/${encodeURIComponent(b)}/${bookDefaultPage(b)}"><code>${b}</code></a></li>`,
    )
    .join("\n      ")
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1" name="viewport" />
    <title>ADT Runtime — Book Chooser</title>
    <style>
      body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; padding: 0 1rem; color: #222; }
      h1 { font-size: 1.4rem; margin: 0 0 1rem; }
      p { color: #555; line-height: 1.5; }
      ul { padding-left: 1.25rem; line-height: 2; }
      a { color: #2563eb; text-decoration: none; }
      a:hover { text-decoration: underline; }
      code { background: #f4f4f5; padding: 0.1em 0.4em; border-radius: 4px; font-size: 0.95em; }
      .empty { color: #b91c1c; }
    </style>
  </head>
  <body>
    <h1>ADT Runtime — Dev Preview</h1>
    ${
      books.length === 0
        ? `<p class="empty">No books found under <code>${booksRoot}</code>. Drop a packaged book at <code>books/&lt;label&gt;/adt/index.html</code>.</p>`
        : `<p>Pick a book to preview. Set <code>ADT_PREVIEW_BOOK=&lt;label&gt;</code> to skip this page.</p>
    <ul>
      ${items}
    </ul>`
    }
  </body>
</html>
`
}


function injectDevRuntime(html: string): string {
  let out = html.replace(
    /\s*<script[^>]+src="\.?\.?\/assets\/(?:adt\/)?(?:offline-preloader|scorm|base\.bundle\.local|base\.bundle\.min)\.js[^"]*"[^>]*><\/script>/g,
    "",
  )
  out = out.replace(
    /<\/body>/,
    `\n    <script type="module" src="/@vite/client"></script>\n    <script type="module" src="/src/boot.tsx"></script>\n  </body>`,
  )
  return out
}

function resolveBookFile(
  pathname: string,
  knownBooks: Set<string>,
): { book: string; absPath: string; rest: string } | null {
  const match = /^\/([^/]+)(?:\/(.*))?$/.exec(pathname)
  if (!match) return null
  const book = decodeURIComponent(match[1])
  if (!knownBooks.has(book)) return null
  const rest = match[2] ?? ""
  const adtDir = bookAdtDir(book)
  const requested = rest === "" ? "index.html" : rest
  const target = path.resolve(adtDir, requested)
  const adtDirResolved = path.resolve(adtDir)
  if (target !== adtDirResolved && !target.startsWith(adtDirResolved + path.sep)) {
    return null
  }
  return { book, absPath: target, rest: requested }
}

function bookDevServerPlugin(): Plugin {
  return {
    name: "adt-runtime-dev-book-server",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next()
        const pathname = req.url.split("?")[0]

        const books = listBooks()

        if (pathname === "/" || pathname === "/index.html") {
          if (PREVIEW_BOOK && books.includes(PREVIEW_BOOK)) {
            res.statusCode = 302
            res.setHeader(
              "Location",
              `/${encodeURIComponent(PREVIEW_BOOK)}/${bookDefaultPage(PREVIEW_BOOK)}`,
            )
            return res.end()
          }
          res.statusCode = 200
          res.setHeader("Content-Type", "text/html; charset=utf-8")
          res.setHeader("Cache-Control", "no-cache")
          return res.end(chooserHtml(books))
        }

        if (
          pathname.startsWith("/@") ||
          pathname.startsWith("/src/") ||
          pathname.startsWith("/node_modules/") ||
          pathname === "/favicon.ico"
        ) {
          return next()
        }

        const resolved = resolveBookFile(pathname, new Set(books))
        if (!resolved) return next()

        let stat: fs.Stats
        try {
          stat = fs.statSync(resolved.absPath)
        } catch {
          return next()
        }
        if (stat.isDirectory()) {
          if (resolved.rest !== "index.html") {
            return next()
          }
        }

        const ext = path.extname(resolved.absPath).toLowerCase()
        if (ext === ".html") {
          try {
            const raw = fs.readFileSync(resolved.absPath, "utf-8")
            const withRuntime = injectDevRuntime(raw)
            const transformed = await server.transformIndexHtml(req.url, withRuntime)
            res.statusCode = 200
            res.setHeader("Content-Type", "text/html; charset=utf-8")
            res.setHeader("Cache-Control", "no-cache")
            return res.end(transformed)
          } catch (err) {
            console.error("[adt-runtime] book HTML serve failed:", err)
            return next(err as Error)
          }
        }

        res.statusCode = 200
        res.setHeader("Content-Type", STATIC_MIME[ext] ?? "application/octet-stream")
        res.setHeader("Content-Length", stat.size.toString())
        res.setHeader("Cache-Control", "no-cache")
        fs.createReadStream(resolved.absPath).on("error", (err) => {
          console.error("[adt-runtime] book asset stream failed:", err)
          if (!res.writableEnded) res.end()
        }).pipe(res)
      })
    },
  }
}

const initialBooks = listBooks()

if (initialBooks.length === 0) {
  console.warn(
    `\n[adt-runtime] ⚠ No books found under ${booksRoot}\n` +
      `[adt-runtime]   Drop a packaged book at books/<label>/adt/ to preview.\n`,
  )
} else {
  console.log(
    `[adt-runtime] Serving ${initialBooks.length} book${initialBooks.length === 1 ? "" : "s"} from ${booksRoot}: ${initialBooks.join(", ")}`,
  )
}

export { bookDevServerPlugin, booksRoot }
