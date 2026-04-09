import fs from "node:fs"
import path from "node:path"
import type { Storage } from "@adt/storage"
import type { BookMetadata, TocGenerationOutput } from "@adt/types"
import { type PackageAdtWebOptions, copyDirRecursive, injectWebpubStyles, htmlToXhtml } from "./package-web.js"

export type PackageEpubOptions = PackageAdtWebOptions

interface PageEntry {
  section_id: string
  href: string
  page_number?: number
}

/** Files/dirs in adt/ root that are SCORM/offline-specific and not needed in EPUB. */
const EPUB_SKIP = new Set(["imsmanifest.xml", "AGENTS.md"])

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Package an EPUB 3 from the existing ADT web package.
 *
 * Follows the same pattern as `packageWebpub`: copies `adt/` into
 * `epub/OEBPS/`, injects reader-override styles, then layers EPUB-specific
 * metadata files (OPF, NCX, container.xml, navigation document) on top.
 *
 * Requires `packageAdtWeb` to have been run first.
 */
export function packageEpub(
  storage: Storage,
  options: PackageEpubOptions,
): void {
  const { bookDir, title, language } = options

  const adtDir = path.join(bookDir, "adt")
  if (!fs.existsSync(adtDir)) {
    throw new Error("ADT package not found — run packageAdtWeb first")
  }

  const epubDir = path.join(bookDir, "epub")
  const oebpsDir = path.join(epubDir, "OEBPS")

  // Clean previous build
  if (fs.existsSync(epubDir)) fs.rmSync(epubDir, { recursive: true })

  // Copy adt/ -> epub/OEBPS/, skipping SCORM-specific files
  copyDirRecursive(adtDir, oebpsDir, EPUB_SKIP)

  // Strip SCORM adapter from assets/
  const scormJs = path.join(oebpsDir, "assets", "scorm.js")
  if (fs.existsSync(scormJs)) fs.unlinkSync(scormJs)
  const offlineJs = path.join(oebpsDir, "assets", "offline-preloader.js")
  if (fs.existsSync(offlineJs)) fs.unlinkSync(offlineJs)

  // Override config: disable navigation controls and tutorial for EPUB readers
  const configPath = path.join(oebpsDir, "assets", "config.json")
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    config.features.showNavigationControls = false
    config.features.showTutorial = false
    if (options.fixedLayout) {
      config.fixedLayout = true
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

    // Inject config as inline script so it's available before the async bundle.
    // Apple Books may not support fetch() for local resources, so the async
    // config.json load can fail — causing features to fall back to defaults.
    const inlineConfigScript = `<script>window.appConfig=${JSON.stringify(config)};</script>`
    injectInlineScript(oebpsDir, inlineConfigScript)
  }

  // Inject reader-override CSS
  injectWebpubStyles(oebpsDir, { fixedLayout: options.fixedLayout })

  // ------------------------------------------------------------------
  // Convert content HTML pages to XHTML (required by EPUB 3 / Apple Books)
  // ------------------------------------------------------------------
  const pagesJsonPath = path.join(oebpsDir, "content", "pages.json")
  const rawPages = JSON.parse(fs.readFileSync(pagesJsonPath, "utf-8")) as PageEntry[]
  for (const page of rawPages) {
    if (!page.href.endsWith(".html")) continue
    const htmlPath = path.join(oebpsDir, page.href)
    if (!fs.existsSync(htmlPath)) continue

    const html = fs.readFileSync(htmlPath, "utf-8")
    const xhtml = convertPageToXhtml(html)
    const xhtmlHref = page.href.replace(/\.html$/, ".xhtml")

    fs.writeFileSync(path.join(oebpsDir, xhtmlHref), xhtml)
    fs.unlinkSync(htmlPath)
    page.href = xhtmlHref
  }
  // Update pages.json with .xhtml hrefs
  fs.writeFileSync(pagesJsonPath, JSON.stringify(rawPages, null, 2))

  // ------------------------------------------------------------------
  // Load metadata
  // ------------------------------------------------------------------
  const metadataRow = storage.getLatestNodeData("metadata", "book")
  const metadata = metadataRow?.data as BookMetadata | undefined
  const authors = metadata?.authors ?? []
  const publisher = metadata?.publisher ?? undefined

  const tocRow = storage.getLatestNodeData("toc-generation", "book")
  const llmToc = tocRow?.data as TocGenerationOutput | undefined

  // ------------------------------------------------------------------
  // Read pages.json for reading order
  // ------------------------------------------------------------------
  const pagesPath = path.join(oebpsDir, "content", "pages.json")
  const pageList = JSON.parse(fs.readFileSync(pagesPath, "utf-8")) as PageEntry[]

  // ------------------------------------------------------------------
  // Enumerate all files for OPF manifest
  // ------------------------------------------------------------------
  const allFiles: Array<{ href: string; mediaType: string }> = []
  collectFiles(oebpsDir, oebpsDir, allFiles)

  // ------------------------------------------------------------------
  // Detect cover image
  // ------------------------------------------------------------------
  let coverHref: string | undefined
  for (const name of ["cover.png", "cover.jpg", "cover.jpeg"]) {
    if (fs.existsSync(path.join(oebpsDir, name))) {
      coverHref = name
      break
    }
  }

  // ------------------------------------------------------------------
  // Write EPUB-specific files
  // ------------------------------------------------------------------

  // mimetype (must be first file in ZIP, uncompressed — export service handles this)
  fs.writeFileSync(path.join(epubDir, "mimetype"), "application/epub+zip")

  // META-INF/container.xml
  fs.mkdirSync(path.join(epubDir, "META-INF"), { recursive: true })
  fs.writeFileSync(path.join(epubDir, "META-INF", "container.xml"), CONTAINER_XML)

  // META-INF/com.apple.ibooks.display-options.xml (Apple Books compatibility)
  if (options.fixedLayout) {
    fs.writeFileSync(
      path.join(epubDir, "META-INF", "com.apple.ibooks.display-options.xml"),
      IBOOKS_DISPLAY_OPTIONS,
    )
  }

  // OEBPS/content.opf
  fs.writeFileSync(
    path.join(oebpsDir, "content.opf"),
    buildOpf({ title, authors, publisher, language, pageList, allFiles, coverHref, fixedLayout: options.fixedLayout }),
  )

  // OEBPS/toc.xhtml (EPUB 3 navigation document)
  fs.writeFileSync(
    path.join(oebpsDir, "toc.xhtml"),
    buildNavDocument(language, title, pageList, llmToc),
  )

  // OEBPS/toc.ncx (EPUB 2 fallback)
  fs.writeFileSync(
    path.join(oebpsDir, "toc.ncx"),
    buildNcx(title, pageList),
  )
}

// ---------------------------------------------------------------------------
// File enumeration
// ---------------------------------------------------------------------------

const EPUB_MIME_TYPES: Record<string, string> = {
  ".xhtml": "application/xhtml+xml",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".dic": "application/octet-stream",
}

function collectFiles(
  baseDir: string,
  dir: string,
  out: Array<{ href: string; mediaType: string }>,
): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(baseDir, fullPath, out)
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/")
      const ext = path.extname(entry.name).toLowerCase()
      out.push({
        href: relPath,
        mediaType: EPUB_MIME_TYPES[ext] ?? "application/octet-stream",
      })
    }
  }
}

// ---------------------------------------------------------------------------
// EPUB structural documents
// ---------------------------------------------------------------------------

const IBOOKS_DISPLAY_OPTIONS = `<?xml version="1.0" encoding="UTF-8"?>
<display_options>
  <platform name="*">
    <option name="specified-fonts">true</option>
    <option name="fixed-layout">true</option>
    <option name="open-to-spread">false</option>
  </platform>
</display_options>`

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`

function buildOpf(opts: {
  title: string
  authors: string[]
  publisher?: string
  language: string
  pageList: PageEntry[]
  allFiles: Array<{ href: string; mediaType: string }>
  coverHref?: string
  fixedLayout?: boolean
}): string {
  const { title, authors, publisher, language, pageList, allFiles, coverHref, fixedLayout } = opts
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z")

  // Metadata
  const metaLines: string[] = [
    `    <dc:identifier>urn:uuid:${crypto.randomUUID()}</dc:identifier>`,
    `    <dc:title>${escapeXml(title)}</dc:title>`,
    `    <dc:language>${escapeXml(language)}</dc:language>`,
    `    <meta property="dcterms:modified">${now}</meta>`,
  ]
  for (const author of authors) {
    metaLines.push(`    <dc:creator>${escapeXml(author)}</dc:creator>`)
  }
  if (publisher) {
    metaLines.push(`    <dc:publisher>${escapeXml(publisher)}</dc:publisher>`)
  }
  if (coverHref) {
    metaLines.push(`    <meta name="cover" content="cover-image"/>`)
  }
  if (fixedLayout) {
    metaLines.push(`    <meta property="rendition:layout">pre-paginated</meta>`)
    metaLines.push(`    <meta property="rendition:spread">none</meta>`)
  }

  // Manifest — enumerate all files in OEBPS
  const manifestLines: string[] = [
    `    <item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
  ]

  // Track IDs to avoid duplicates (toc.xhtml and toc.ncx are already listed)
  const skipHrefs = new Set(["toc.xhtml", "toc.ncx", "content.opf"])
  const pageHrefs = new Set(pageList.map(p => p.href))
  const hrefToItemId = new Map<string, string>()
  let itemIndex = 0

  for (const file of allFiles) {
    if (skipHrefs.has(file.href)) continue

    const itemId = file.href === coverHref
      ? "cover-image"
      : `item-${++itemIndex}`
    hrefToItemId.set(file.href, itemId)

    const props: string[] = []
    if (file.href === coverHref) props.push("cover-image")
    if (!fixedLayout && pageHrefs.has(file.href)) props.push("scripted")
    const propsAttr = props.length > 0 ? ` properties="${props.join(" ")}"` : ""

    manifestLines.push(
      `    <item id="${escapeXml(itemId)}" href="${escapeXml(file.href)}" media-type="${file.mediaType}"${propsAttr}/>`,
    )
  }

  // Spine — reading order from pages.json
  const spineLines = pageList.map((page) => {
    const itemId = hrefToItemId.get(page.href) ?? escapeXml(page.section_id)
    return `    <itemref idref="${escapeXml(itemId)}"/>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id"${fixedLayout ? ` prefix="rendition: http://www.idpf.org/vocab/rendition/#"` : ""}>
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
${metaLines.join("\n")}
  </metadata>
  <manifest>
${manifestLines.join("\n")}
  </manifest>
  <spine toc="ncx">
${spineLines.join("\n")}
  </spine>
</package>`
}

function buildNavDocument(
  language: string,
  title: string,
  pageList: PageEntry[],
  llmToc?: TocGenerationOutput,
): string {
  let tocItems: string

  if (llmToc && llmToc.entries.length > 0) {
    // Use LLM-generated TOC — map sectionIds to page hrefs
    const sectionMap = new Map(pageList.map((p) => [p.section_id, p.href]))
    tocItems = llmToc.entries
      .map((e) => {
        const href = sectionMap.get(e.sectionId)
        if (!href) return ""
        const indent = "      " + "  ".repeat(Math.max(0, e.level - 1))
        return `${indent}<li><a href="${escapeXml(href)}">${escapeXml(e.title)}</a></li>`
      })
      .filter(Boolean)
      .join("\n")
  } else {
    // Fallback: one entry per page
    tocItems = pageList
      .map((p) => {
        const label = p.page_number != null ? `Page ${p.page_number}` : p.section_id
        return `      <li><a href="${escapeXml(p.href)}">${escapeXml(label)}</a></li>`
      })
      .join("\n")
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(title)}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${tocItems}
    </ol>
  </nav>
</body>
</html>`
}

function buildNcx(title: string, pageList: PageEntry[]): string {
  const navPoints = pageList
    .map((p, i) => {
      const label = p.page_number != null ? `Page ${p.page_number}` : p.section_id
      return `    <navPoint id="navpoint-${i + 1}" playOrder="${i + 1}">
      <navLabel><text>${escapeXml(label)}</text></navLabel>
      <content src="${escapeXml(p.href)}"/>
    </navPoint>`
    })
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Inject an inline `<script>` tag into all HTML/XHTML content pages in a directory.
 * Inserts right before `</head>` so the script runs before the body is parsed.
 */
function injectInlineScript(dir: string, script: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      injectInlineScript(fullPath, script)
    } else if (entry.isFile() && /\.(html|xhtml)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, "utf-8")
      if (content.includes("</head>")) {
        fs.writeFileSync(fullPath, content.replace("</head>", `${script}\n</head>`))
      }
    }
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/**
 * Convert an HTML content page to well-formed XHTML for EPUB 3.
 *
 * - Adds XML declaration and XHTML namespace
 * - Converts HTML to XML-safe markup (self-closing tags, etc.)
 * - Preserves all inline styles and content
 */
function convertPageToXhtml(html: string): string {
  // Extract the content between <html> and </html>, converting the body
  const xhtmlBody = htmlToXhtml(html)

  // The htmlToXhtml parser strips the doctype and may mangle the html tag.
  // Rebuild a clean XHTML document with proper namespace.
  // Extract lang attribute from original
  const langMatch = html.match(/lang="([^"]*)"/)
  const lang = langMatch ? langMatch[1] : "en"

  // Extract <head> content (between <head> and </head>)
  const headMatch = xhtmlBody.match(/<head[^>]*>([\s\S]*?)<\/head>/)
  const headContent = headMatch ? headMatch[1] : ""

  // Extract <body> with attributes and content
  const bodyMatch = xhtmlBody.match(/<body([^>]*)>([\s\S]*?)<\/body>/)
  const bodyAttrs = bodyMatch ? bodyMatch[1] : ""
  const bodyContent = bodyMatch ? bodyMatch[2] : ""

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(lang)}">
<head>
${headContent}
</head>
<body${bodyAttrs}>
${bodyContent}
</body>
</html>`
}
