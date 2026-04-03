import fs from "node:fs"
import path from "node:path"
import type { Storage } from "@adt/storage"
import type { BookMetadata, TocGenerationOutput } from "@adt/types"
import { type PackageAdtWebOptions, copyDirRecursive, injectWebpubStyles } from "./package-web.js"

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

  // Inject reader-override CSS (same as webpub)
  injectWebpubStyles(oebpsDir)

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

  // OEBPS/content.opf
  fs.writeFileSync(
    path.join(oebpsDir, "content.opf"),
    buildOpf({ title, authors, publisher, language, pageList, allFiles, coverHref }),
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
}): string {
  const { title, authors, publisher, language, pageList, allFiles, coverHref } = opts
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
    if (pageHrefs.has(file.href)) props.push("scripted")
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
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
