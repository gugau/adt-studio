import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { parseDocument, DomUtils } from "htmlparser2"
import temml from "temml"
import type { Storage } from "@adt/storage"
import type {
  ContentNodeData,
  PageSectioningOutput,
  PageSectioningSection,
  TextCatalogOutput,
  GlossaryOutput,
  QuizGenerationOutput,
  BookSummaryOutput,
  BookMetadata,
  SpeechConfig,
  TTSOutput,
  WordTimestampOutput,
  TocGenerationOutput,
  Quiz,
  ActivityTemplate,
  QuizActivityType,
  QuizQuestion,
  QuizImageAsset,
  ImageCaptioningOutput,
} from "@adt/types"
import { WebRenderingOutput as WebRenderingOutputSchema } from "@adt/types"
import type { Progress } from "./progress.js"
import { nullProgress } from "./progress.js"
import { getGlossaryItemTextId } from "./glossary.js"
import { getBaseLanguage, normalizeLocale } from "./language-context.js"
import { buildTextCatalog } from "./text-catalog.js"
import { normalizeHtmlSectionSemantics } from "./html-semantics.js"

export interface PackageAdtWebOptions {
  bookDir: string
  label: string
  language: string
  outputLanguages: string[]
  title: string
  webAssetsDir: string
  bundleVersion?: string
  applyBodyBackground?: boolean
  speechConfig?: SpeechConfig
  features?: {
    glossary?: boolean
    readAloud?: boolean
    quizzes?: boolean
    signLanguage?: boolean
  }
}

interface PageEntry {
  section_id: string
  href: string
  page_number?: number
}

interface RuntimeTimecodeEntry {
  timecodes: [null, {
    word_timestamps: Array<{ text: string; start: number; end: number }>
  }]
}

// ---------------------------------------------------------------------------
// Build-cache helpers
// ---------------------------------------------------------------------------

function collectDirectoryFingerprint(dirPath: string, prefix = ""): Array<[string, number, number]> {
  if (!fs.existsSync(dirPath)) return []
  const entries: Array<[string, number, number]> = []
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      entries.push(...collectDirectoryFingerprint(path.join(dirPath, entry.name), rel))
    } else {
      const stat = fs.statSync(path.join(dirPath, entry.name))
      entries.push([rel, stat.size, Math.trunc(stat.mtimeMs)])
    }
  }
  return entries
}

function getWordTimestamps(
  storage: Storage,
  language: string,
): WordTimestampOutput | undefined {
  const normalizedLanguage = normalizeLocale(language)
  const legacyLanguage = normalizedLanguage.replace("-", "_")
  const row =
    storage.getLatestNodeData("tts-timestamps", normalizedLanguage) ??
    storage.getLatestNodeData("tts-timestamps", legacyLanguage)
  return row?.data as WordTimestampOutput | undefined
}

function buildRuntimeTimecodeMap(
  timestamps: WordTimestampOutput | undefined,
): Record<string, RuntimeTimecodeEntry> {
  const map: Record<string, RuntimeTimecodeEntry> = {}

  for (const [textId, entry] of Object.entries(timestamps?.entries ?? {})) {
    if (entry.words.length === 0) continue
    map[textId] = {
      timecodes: [
        null,
        {
          word_timestamps: entry.words.map((word) => ({
            text: word.word,
            start: word.start,
            end: word.end,
          })),
        },
      ],
    }
  }

  return map
}

export interface ComputePackagingInputHashOptions {
  storage: Storage
  bookDir: string
  label: string
  language: string
  outputLanguages: string[]
  title: string
  webAssetsDir: string
  bundleVersion?: string
  applyBodyBackground?: boolean
  config: Record<string, unknown>
}

export function computePackagingInputHash(options: ComputePackagingInputHashOptions): string {
  const hash = createHash("sha256")

  // 1. Storage entity versions (exclude outputs like accessibility-assessment)
  const fingerprint = options.storage.getNodeVersionFingerprint(["accessibility-assessment"])
  hash.update(JSON.stringify(fingerprint))

  // 2. Packaging options that affect output
  hash.update(JSON.stringify({
    label: options.label,
    language: options.language,
    outputLanguages: options.outputLanguages,
    title: options.title,
    bundleVersion: options.bundleVersion ?? "1",
    applyBodyBackground: options.applyBodyBackground ?? false,
  }))

  // 3. Book config (affects rendering, accessibility, etc.)
  hash.update(JSON.stringify(options.config))

  // 4. Web assets directory fingerprint (file names + sizes + mtimes)
  const assetEntries = collectDirectoryFingerprint(options.webAssetsDir).sort((a, b) => a[0].localeCompare(b[0]))
  hash.update(JSON.stringify(assetEntries))

  // 5. Images directory fingerprint
  const imagesDir = path.join(options.bookDir, "images")
  const imageEntries = collectDirectoryFingerprint(imagesDir).sort((a, b) => a[0].localeCompare(b[0]))
  hash.update(JSON.stringify(imageEntries))

  // 6. Videos directory fingerprint
  const videosDir = path.join(options.bookDir, "videos")
  const videoEntries = collectDirectoryFingerprint(videosDir).sort((a, b) => a[0].localeCompare(b[0]))
  hash.update(JSON.stringify(videoEntries))

  return hash.digest("hex")
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Package all pipeline outputs into a standalone web application at
 * `{bookDir}/adt/`. The output is a self-contained directory that can be
 * opened directly in a browser (file://) or served by any static HTTP server.
 */
export async function packageAdtWeb(
  storage: Storage,
  options: PackageAdtWebOptions,
  progress: Progress = nullProgress,
): Promise<void> {
  const {
    bookDir,
    label,
    language: rawLanguage,
    outputLanguages: rawOutputLanguages,
    title,
    webAssetsDir,
    bundleVersion = "1",
    applyBodyBackground,
    speechConfig,
    features,
  } = options
  const language = normalizeLocale(rawLanguage)
  const outputLanguages = Array.from(new Set(rawOutputLanguages.map((code) => normalizeLocale(code))))

  const step = "package-web" as const
  progress.emit({ type: "step-start", step })
  progress.emit({ type: "step-progress", step, message: "Setting up directories..." })

  const adtDir = path.join(bookDir, "adt")
  const imageDir = path.join(adtDir, "images")
  const contentDir = path.join(adtDir, "content")

  // Clear & create directory structure
  if (fs.existsSync(adtDir)) fs.rmSync(adtDir, { recursive: true })
  fs.mkdirSync(imageDir, { recursive: true })
  fs.mkdirSync(contentDir, { recursive: true })

  // ------------------------------------------------------------------
  // Collect data from storage
  // ------------------------------------------------------------------
  const pages = storage.getPages()
  const imageMap = buildImageMap(path.join(bookDir, "images"))

  // Always rebuild the text catalog to avoid staleness; only persist if changed
  const catalog = await buildTextCatalog(storage, pages)
  const catalogRow = storage.getLatestNodeData("text-catalog", "book")
  const storedEntries = catalogRow
    ? JSON.stringify((catalogRow.data as TextCatalogOutput).entries)
    : null
  if (JSON.stringify(catalog.entries) !== storedEntries) {
    storage.putNodeData("text-catalog", "book", catalog)
  }

  const glossaryRow = storage.getLatestNodeData("glossary", "book")
  const glossary = glossaryRow?.data as GlossaryOutput | undefined

  const quizRow = storage.getLatestNodeData("quiz-generation", "book")
  const quizData = quizRow?.data as QuizGenerationOutput | undefined

  const metadataRow = storage.getLatestNodeData("metadata", "book")
  const metadata = metadataRow?.data as { title?: string | null; cover_page_number?: number | null } | undefined

  const summaryRow = storage.getLatestNodeData("book-summary", "book")
  const bookSummary = (summaryRow?.data as BookSummaryOutput | undefined)?.summary

  const tocRow = storage.getLatestNodeData("toc-generation", "book")
  const llmToc = tocRow?.data as TocGenerationOutput | undefined

  // ------------------------------------------------------------------
  // Process pages
  // ------------------------------------------------------------------
  progress.emit({ type: "step-progress", step, message: "Processing pages..." })

  const pageList: PageEntry[] = []
  const tocEntries: Array<{ section_id: string; href: string; title: string; chapter_id: string }> = []
  let hasMath = false
  let hasActivitySections = false
  const copiedImages = new Set<string>()
  const sectionIdToPageIndex = new Map<string, number>()

  // Build a map from afterPageId -> quizzes for interleaving
  const quizzesByAfterPageId = new Map<string, Quiz[]>()
  const visibleQuizIndex = new Map<Quiz, number>()
  if ((features?.quizzes !== false) && quizData?.quizzes) {
    for (const quiz of quizData.quizzes.filter((q) => !q.isPruned)) {
      visibleQuizIndex.set(quiz, visibleQuizIndex.size)
      const existing = quizzesByAfterPageId.get(quiz.afterPageId) ?? []
      existing.push(quiz)
      quizzesByAfterPageId.set(quiz.afterPageId, existing)
    }
  }

  for (const page of pages) {
    const quizzes = quizzesByAfterPageId.get(page.pageId) ?? []

    const structuringRow = storage.getLatestNodeData("page-sectioning", page.pageId)
    const sectioning = structuringRow?.data as PageSectioningOutput | undefined
    const imageCaptionMap = loadImageCaptionMap(storage, page.pageId)

    const renderRow = storage.getLatestNodeData("web-rendering", page.pageId)
    if (renderRow) {
      const parsed = WebRenderingOutputSchema.safeParse(renderRow.data)
      if (parsed.success) {
        const rendering = parsed.data

        // One HTML file per rendered section (stable by sectionIndex), skip pruned
        const sections = [...rendering.sections].sort((a, b) => a.sectionIndex - b.sectionIndex)
        for (const rs of sections) {
          const sectionMeta = sectioning?.sections[rs.sectionIndex]
          if (sectionMeta?.isPruned) continue
          const sectionId = sectionMeta?.sectionId ?? `${page.pageId}_sec${String(rs.sectionIndex + 1).padStart(3, "0")}`

          if (rs.sectionType.startsWith("activity_") || sectionMeta?.sectionType.startsWith("activity_")) {
            hasActivitySections = true
          }

          // Rewrite image URLs and copy referenced images
          const preferredImageAltMap = buildPreferredImageAltMap(storage, page.pageId, sectionMeta)
          let { html: rewrittenHtml, referencedImages } = rewriteImageUrls(
            rs.html,
            label,
            imageMap,
            preferredImageAltMap,
          )

          for (const imageId of referencedImages) {
            if (!copiedImages.has(imageId)) {
              const filename = imageMap.get(imageId)
              if (filename) {
                fs.copyFileSync(
                  path.join(bookDir, "images", filename),
                  path.join(imageDir, filename),
                )
                copiedImages.add(imageId)
              }
            }
          }

          // Convert LaTeX math to MathML
          const sectionHasMath = containsMathContent(rewrittenHtml)
          if (sectionHasMath) {
            hasMath = true
            rewrittenHtml = convertLatexToMathml(rewrittenHtml)
          }

          const isFirstPage = pageList.length === 0
          const filename = isFirstPage ? "index.html" : `${sectionId}.html`

          const headingText = sectionMeta ? findHeadingText(sectionMeta) : null

          const pageHtml = renderPageHtml({
            content: rewrittenHtml,
            language,
            sectionId,
            pageTitle: title,
            pageHeading: headingText?.text ?? title,
            pageIndex: pageList.length + 1,
            activityAnswers: rs.activityAnswers,
            hasMath: sectionHasMath,
            bundleVersion,
            applyBodyBackground,
          })
          fs.writeFileSync(path.join(adtDir, filename), pageHtml)

          const entry: PageEntry = {
            section_id: sectionId,
            href: filename,
          }
          if (sectionMeta?.pageNumber !== null && sectionMeta?.pageNumber !== undefined) {
            entry.page_number = sectionMeta.pageNumber
          }
          pageList.push(entry)

          // Track sectionId → pageIndex for sign language video mapping
          sectionIdToPageIndex.set(sectionId, pageList.length) // pageIndex = pageList.length (1-based, already pushed)

          // Build TOC entry from first heading text in this section
          if (headingText) {
            tocEntries.push({
              section_id: sectionId,
              href: filename,
              title: headingText.text,
              chapter_id: headingText.textId,
            })
          }
        }
      }
    }

    // Insert quiz pages after this page (even if page content was skipped)
    for (const quiz of quizzes) {
      const quizIndex = visibleQuizIndex.get(quiz) ?? 0
      const quizId = `qz${pad3(quizIndex + 1)}`

      const isFirstPage = pageList.length === 0
      const quizFilename = isFirstPage ? "index.html" : `${quizId}.html`

      for (const imageId of collectQuizImageIds(quiz)) {
        if (!copiedImages.has(imageId)) {
          const filename = imageMap.get(imageId)
          if (filename) {
            fs.copyFileSync(
              path.join(bookDir, "images", filename),
              path.join(imageDir, filename),
            )
            copiedImages.add(imageId)
          }
        }
      }

      const quizHtmlContent = renderQuizHtml(quiz, quizId, catalog, {
        imageSrc: (imageId) => {
          const filename = imageMap.get(imageId)
          return filename ? `images/${filename}` : null
        },
      })
      const quizPageHtml = renderPageHtml({
        content: quizHtmlContent,
        language,
        sectionId: quizId,
        pageTitle: title,
        pageHeading: quiz.question,
        pageIndex: pageList.length + 1,
        activityAnswers: buildQuizAnswers(quiz, quizId),
        hasMath: false,
        bundleVersion,
        skipContentWrapper: true,
        applyBodyBackground,
      })
      fs.writeFileSync(path.join(adtDir, quizFilename), quizPageHtml)

      pageList.push({ section_id: quizId, href: quizFilename })
    }
  }

  // ------------------------------------------------------------------
  // Write manifests
  // ------------------------------------------------------------------
  progress.emit({ type: "step-progress", step, message: "Writing manifests..." })

  writeJson(path.join(contentDir, "pages.json"), pageList)

  // Table of contents — prefer LLM-generated TOC, fallback to heading-based
  if (llmToc && llmToc.entries.length > 0) {
    // Map LLM entries to the flat format expected by the runtime, resolving
    // hrefs from the page list (the first page is always index.html)
    const hrefMap = new Map(pageList.map((p) => [p.section_id, p.href]))
    const tocJson = llmToc.entries.map((e) => ({
      section_id: e.sectionId,
      href: hrefMap.get(e.sectionId) ?? e.href,
      title: e.title,
      chapter_id: e.chapterId,
      level: e.level,
    }))
    writeJson(path.join(contentDir, "toc.json"), tocJson)
  } else {
    writeJson(path.join(contentDir, "toc.json"), tocEntries)
  }

  // ------------------------------------------------------------------
  // Cover image
  // ------------------------------------------------------------------
  if (metadata?.cover_page_number !== null && metadata?.cover_page_number !== undefined) {
    const coverPageId = pages.find(
      (p) => p.pageNumber === metadata.cover_page_number,
    )?.pageId
    if (coverPageId) {
      const coverImageId = `${coverPageId}_page`
      const coverFilename = imageMap.get(coverImageId)
      if (coverFilename) {
        fs.copyFileSync(
          path.join(bookDir, "images", coverFilename),
          path.join(adtDir, `cover${path.extname(coverFilename)}`),
        )
      }
    }
  }

  // ------------------------------------------------------------------
  // Navigation
  // ------------------------------------------------------------------
  const navDir = path.join(contentDir, "navigation")
  fs.mkdirSync(navDir, { recursive: true })
  fs.writeFileSync(path.join(navDir, "nav.html"), NAV_HTML)

  // ------------------------------------------------------------------
  // i18n — per-language content
  // ------------------------------------------------------------------
  progress.emit({ type: "step-progress", step, message: "Packaging translations and audio..." })

  const sourceLanguage = getBaseLanguage(language)
  const hasTTS = (features?.readAloud !== false) && outputLanguages.some(
    (lang) => {
      const legacyLang = lang.replace("-", "_")
      return (
        storage.getLatestNodeData("tts", lang) !== null ||
        storage.getLatestNodeData("tts", legacyLang) !== null
      )
    },
  )
  const highlightEnabled = hasTTS && speechConfig?.word_highlighting === true

  for (const lang of outputLanguages) {
    const localeDir = path.join(contentDir, "i18n", lang)
    fs.mkdirSync(localeDir, { recursive: true })

    // texts.json
    const baseLang = getBaseLanguage(lang)
    let textsMap: Record<string, string> = {}
    if (baseLang === sourceLanguage) {
      // Source language — use original catalog
      if (catalog?.entries) {
        for (const e of catalog.entries) textsMap[e.id] = e.text
      }
    } else {
      // Translated language
      const legacyLang = lang.replace("-", "_")
      const transRow =
        storage.getLatestNodeData("text-catalog-translation", lang) ??
        storage.getLatestNodeData("text-catalog-translation", legacyLang)
      if (transRow) {
        const translated = transRow.data as TextCatalogOutput
        for (const e of translated.entries) textsMap[e.id] = e.text
      }
    }
    // Convert any LaTeX in text catalog entries to MathML
    for (const [id, text] of Object.entries(textsMap)) {
      if (containsMathContent(text)) {
        textsMap[id] = convertLatexString(text)
      }
    }
    writeJson(path.join(localeDir, "texts.json"), textsMap)

    // audios.json + copy audio files
    const audioMap: Record<string, string> = {}

    if (features?.readAloud !== false) {
      const audioDir = path.join(localeDir, "audio")
      fs.mkdirSync(audioDir, { recursive: true })

      const legacyLang = lang.replace("-", "_")
      const ttsRow =
        storage.getLatestNodeData("tts", lang) ??
        storage.getLatestNodeData("tts", legacyLang)
      const ttsData = ttsRow?.data as TTSOutput | undefined

      if (ttsData?.entries) {
        for (const entry of ttsData.entries) {
          const srcFile = path.join(bookDir, "audio", lang, entry.fileName)
          const legacySrcFile = path.join(bookDir, "audio", legacyLang, entry.fileName)
          const resolvedSrcFile = fs.existsSync(srcFile) ? srcFile : legacySrcFile
          if (fs.existsSync(resolvedSrcFile)) {
            const destFile = path.join(audioDir, entry.fileName)
            fs.copyFileSync(resolvedSrcFile, destFile)
            audioMap[entry.textId] = entry.fileName
          }
        }
      }
    }
    writeJson(path.join(localeDir, "audios.json"), audioMap)

    // timecode/timecode_output.json — word timings consumed by the reader runtime
    const timecodeDir = path.join(localeDir, "timecode")
    fs.mkdirSync(timecodeDir, { recursive: true })
    writeJson(
      path.join(timecodeDir, "timecode_output.json"),
      highlightEnabled
        ? buildRuntimeTimecodeMap(getWordTimestamps(storage, lang))
        : {},
    )

    // videos.json — map "video-{pageIndex}" → video filename for assigned sign language videos
    // The ADT JS runtime expects keys prefixed with "video-" and files in a "video/" directory.
    // Each video is assigned to a sectionId which maps 1:1 to a pageIndex.
    const videosMap: Record<string, string> = {}
    if (features?.signLanguage !== false) {
      const allVideos = storage.getSignLanguageVideos()
      const videoDir = path.join(localeDir, "video")
      if (allVideos.some((v) => v.sectionId)) {
        fs.mkdirSync(videoDir, { recursive: true })
        for (const video of allVideos) {
          if (!video.sectionId) continue
          const ext = video.mimeType === "video/webm" ? ".webm" : ".mp4"
          // Use section-based naming (e.g. sl_pg001_sec001.mp4) matching audio file conventions
          const filename = `sl_${video.sectionId}${ext}`
          const srcPath = storage.getSignLanguageVideoPath(video.videoId)
          if (srcPath && fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, path.join(videoDir, filename))
            const idx = sectionIdToPageIndex.get(video.sectionId)
            if (idx !== undefined) {
              videosMap[`video-${idx}`] = filename
            }
          }
        }
      }
    }
    writeJson(path.join(localeDir, "videos.json"), videosMap)

    // images.json — map original imageId → localized variant filename for this language.
    // Variants are produced by the image-translation step and stored as
    // `${sourceImageId}_tr_${languageCode}` in the book images directory.
    const imagesMap: Record<string, string> = {}
    const variantSuffix = `_tr_${lang.replace(/[^a-zA-Z0-9-]/g, "_")}`
    for (const originalImageId of copiedImages) {
      const variantId = `${originalImageId}${variantSuffix}`
      const variantFilename = imageMap.get(variantId)
      if (!variantFilename) continue
      const destPath = path.join(imageDir, variantFilename)
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(
          path.join(bookDir, "images", variantFilename),
          destPath,
        )
      }
      imagesMap[originalImageId] = variantFilename
    }
    writeJson(path.join(localeDir, "images.json"), imagesMap)

    if (features?.glossary !== false) {
      const glossaryJson = buildGlossaryJson(glossary, catalog, textsMap, baseLang === sourceLanguage)
      writeJson(path.join(localeDir, "glossary.json"), glossaryJson)
    }
  }

  // ------------------------------------------------------------------
  // config.json
  // ------------------------------------------------------------------
  const hasGlossary = (features?.glossary !== false) && (glossary !== undefined && glossary.items.some((item) => !item.pruned))
  const hasQuiz = (features?.quizzes !== false) && (quizData !== undefined && quizData.quizzes.length > 0)

  const hasSignLanguageVideos = (features?.signLanguage !== false) && storage.getSignLanguageVideos().some((v) => v.sectionId !== null)

  const configJson = {
    title,
    bundleVersion,
    languages: {
      available: outputLanguages,
      default: pickDefaultLanguage(language, outputLanguages),
    },
    features: {
      signLanguage: hasSignLanguageVideos,
      easyRead: false,
      glossary: hasGlossary,
      eli5: false,
      readAloud: hasTTS,
      autoplay: true,
      showTutorial: true,
      showNavigationControls: true,
      describeImages: true,
      notepad: false,
      state: true,
      characterDisplay: false,
      highlight: highlightEnabled,
      activities: hasQuiz || hasActivitySections,
    },
    analytics: {
      enabled: false,
      siteId: 0,
      trackerUrl: "https://unisitetracker.unicef.io/matomo.php",
      srcUrl: "https://unisitetracker.unicef.io/matomo.js",
    },
  }

  // ------------------------------------------------------------------
  // Copy web assets
  // ------------------------------------------------------------------
  progress.emit({ type: "step-progress", step, message: "Copying web assets..." })

  const assetsDir = path.join(adtDir, "assets")
  copyDirRecursive(webAssetsDir, assetsDir, new Set(["interface_translations"]))

  // Copy only required interface translations
  const itSrc = path.join(webAssetsDir, "interface_translations")
  if (fs.existsSync(itSrc)) {
    const itDest = path.join(assetsDir, "interface_translations")
    fs.mkdirSync(itDest, { recursive: true })
    for (const lang of outputLanguages) {
      const langSrc = path.join(itSrc, lang)
      const baseLangSrc = path.join(itSrc, getBaseLanguage(lang))
      const src = fs.existsSync(langSrc) ? langSrc : fs.existsSync(baseLangSrc) ? baseLangSrc : null
      if (src) {
        copyDirRecursive(src, path.join(itDest, lang))
      }
    }
  }

  // Write config.json (overwrites the template one from assets)
  writeJson(path.join(assetsDir, "config.json"), configJson)

  // ------------------------------------------------------------------
  // Build JS bundle (base.js → base.bundle.min.js)
  // ------------------------------------------------------------------
  progress.emit({ type: "step-progress", step, message: "Building JS bundle..." })
  await buildJsBundle(webAssetsDir, assetsDir)

  // ------------------------------------------------------------------
  // Build Tailwind CSS
  // ------------------------------------------------------------------
  progress.emit({ type: "step-progress", step, message: "Building Tailwind CSS..." })
  await buildTailwindCss(adtDir, webAssetsDir)

  // ------------------------------------------------------------------
  // SCORM + Offline support
  // ------------------------------------------------------------------
  progress.emit({ type: "step-progress", step, message: "Generating offline & SCORM support..." })

  const activityIds = collectActivityIds(adtDir, pageList)
  generateScormAdapter(assetsDir, activityIds)

  // Offline preloader must run last — it reads the final state of all files
  generateOfflinePreloader(adtDir, outputLanguages)

  generateImsManifest(adtDir, title, label, pageList)

  // Render AGENTS.md from Liquid template with book-specific data
  const agentsMdTemplate = path.join(path.dirname(webAssetsDir), "AGENTS.md.liquid")
  if (fs.existsSync(agentsMdTemplate)) {
    const agentsMd = await renderAgentsMd(agentsMdTemplate, {
      title,
      label,
      summary: bookSummary,
      language,
      outputLanguages,
      pageList,
      catalog,
      glossary,
      quizData,
      imageMap,
      configJson,
      hasGlossary,
      hasQuiz,
    })
    fs.writeFileSync(path.join(adtDir, "AGENTS.md"), agentsMd)
  }

  progress.emit({ type: "step-complete", step })
}

// ---------------------------------------------------------------------------
// WebPub packaging
// ---------------------------------------------------------------------------

const WEBPUB_MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".js": "application/javascript",
  ".json": "application/json",
}

/**
 * Package the book as a Readium WebPub directory at `{bookDir}/webpub/`.
 *
 * Assumes ADT web packaging has already been run (i.e. `{bookDir}/adt/` exists).
 * Copies the ADT directory to `{bookDir}/webpub/`, adds a Readium WebPub
 * manifest, and tweaks config for embedded reading. The caller is responsible
 * for zipping the result into a `.webpub` file.
 */
export function packageWebpub(
  storage: Storage,
  options: PackageAdtWebOptions,
): void {
  const { bookDir, title } = options

  const adtDir = path.join(bookDir, "adt")
  if (!fs.existsSync(adtDir)) {
    throw new Error("ADT package not found — run packageAdtWeb first")
  }

  const webpubDir = path.join(bookDir, "webpub")

  // Copy adt/ -> webpub/
  if (fs.existsSync(webpubDir)) fs.rmSync(webpubDir, { recursive: true })
  copyDirRecursive(adtDir, webpubDir)

  // Override config: disable navigation controls and tutorial for embedded reading
  const configPath = path.join(webpubDir, "assets", "config.json")
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"))
    config.features.showNavigationControls = false
    config.features.showTutorial = false
    writeJson(configPath, config)
  }

  // Inject CSS into HTML pages to prevent readers (e.g. Thorium) from applying
  // column-based pagination which breaks the single-page ADT layout.
  injectWebpubStyles(webpubDir)

  // Load metadata for manifest
  const metadataRow = storage.getLatestNodeData("metadata", "book")
  const metadata = metadataRow?.data as BookMetadata | undefined

  const manifestMetadata: Record<string, unknown> = {
    "@type": "http://schema.org/Book",
    title,
    language: options.language,
    modified: new Date().toISOString(),
    // Tell readers to scroll each page rather than paginating into columns,
    // and not to display two pages side-by-side (spread).
    presentation: {
      overflow: "scrolled",
      spread: "none",
    },
  }
  if (metadata?.authors?.length) {
    manifestMetadata.author = metadata.authors.join(", ")
  }
  if (metadata?.publisher) {
    manifestMetadata.publisher = metadata.publisher
  }

  // Links
  const links: Array<Record<string, string>> = [
    { rel: "self", href: "manifest.json", type: "application/webpub+json" },
  ]
  for (const [filename, mimeType] of [
    ["cover.png", "image/png"],
    ["cover.jpg", "image/jpeg"],
    ["cover.jpeg", "image/jpeg"],
  ] as const) {
    if (fs.existsSync(path.join(webpubDir, filename))) {
      links.push({ rel: "cover", href: filename, type: mimeType })
      break
    }
  }

  // Reading order from pages.json
  const pagesPath = path.join(webpubDir, "content", "pages.json")
  const pageList = JSON.parse(fs.readFileSync(pagesPath, "utf-8")) as PageEntry[]
  const readingOrder = pageList.map((page) => ({
    href: page.href,
    type: "text/html",
    title: page.page_number != null ? String(page.page_number) : page.section_id,
  }))

  // Enumerate all files as resources
  const resources: Array<{ href: string; type: string }> = []
  collectWebpubResources(webpubDir, webpubDir, resources)

  // Write manifest
  const manifest = {
    "@context": "https://readium.org/webpub-manifest/context.jsonld",
    metadata: manifestMetadata,
    links,
    readingOrder,
    resources,
  }
  writeJson(path.join(webpubDir, "manifest.json"), manifest)
}

const WEBPUB_OVERRIDE_CSS = `<style>
/* ── WebPub / EPUB reader overrides ──
   EPUB readers like Thorium inject their own column-based pagination.
   The ADT pages use Tailwind flex centering and responsive breakpoints
   that don't work well in reflowable EPUB viewports. Override everything
   to simple block flow with single-column layout. */

/* Prevent reader column pagination */
:root, html, body {
  columns: auto !important;
  column-width: auto !important;
  column-count: auto !important;
  column-gap: normal !important;
  overflow: visible !important;
}

/* Body: block flow, no flex centering, no viewport-height minimum */
body {
  display: block !important;
  min-height: auto !important;
  height: auto !important;
  max-width: none !important;
  max-height: none !important;
}

/* Content wrapper: block flow, visible (JS fade-in won't run in readers) */
#content {
  display: block !important;
  min-height: auto !important;
  height: auto !important;
  max-width: 100% !important;
  opacity: 1 !important;
}

/* Force single-column layout for all section containers.
   Side-by-side (lg:flex-row) layouts squeeze text in narrow
   reader viewports. */
section > div {
  flex-direction: column !important;
  max-width: 100% !important;
}

/* Remove max-width constraints on nested containers (max-w-6xl, max-w-xl, etc.) */
.container,
section [class*="max-w-"] {
  max-width: 100% !important;
}

/* Responsive images */
img {
  max-width: 100% !important;
  height: auto !important;
}
</style>`

/**
 * Walk all .html files in `dir` and inject a `<style>` block right before
 * `</head>` that overrides reader-injected column pagination CSS.
 */
function injectWebpubStyles(dir: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      injectWebpubStyles(fullPath)
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      let html = fs.readFileSync(fullPath, "utf-8")
      html = html.replace("</head>", `${WEBPUB_OVERRIDE_CSS}\n</head>`)
      fs.writeFileSync(fullPath, html)
    }
  }
}

function collectWebpubResources(
  baseDir: string,
  dir: string,
  out: Array<{ href: string; type: string }>,
): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectWebpubResources(baseDir, fullPath, out)
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/")
      const ext = path.extname(entry.name).toLowerCase()
      out.push({
        href: relPath,
        type: WEBPUB_MIME_TYPES[ext] ?? "application/octet-stream",
      })
    }
  }
}


// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

export interface RenderPageOptions {
  content: string
  language: string
  sectionId: string
  pageTitle: string
  pageIndex: number
  activityAnswers?: Record<string, string | boolean | number>
  hasMath: boolean
  bundleVersion: string
  pageHeading?: string
  /** When true, content is placed directly inside the page-level <main> without adding a
   *  generated <div id="content"> wrapper. Used for quiz pages whose template provides
   *  its own #content element. */
  skipContentWrapper?: boolean
  applyBodyBackground?: boolean
  /** When true, renders a minimal page without navigation/sidebar chrome.
   *  Content is visible immediately (no opacity-0). Used for storyboard preview. */
  embed?: boolean
}

/**
 * Add `opacity-0` to the first `<div id="content">` element's class list.
 * Used when the LLM-generated content already provides its own wrapper div so
 * we don't add a duplicate — but still need the fade-in class for the ADT animation.
 */
function injectOpacityClass(html: string): string {
  return html.replace(
    /(<div\b[^>]*\bid="content"[^>]*)>/,
    (_, opening) => {
      if (/\bopacity-0\b/.test(opening)) return opening + ">"
      const hasClass = /\bclass="/.test(opening)
      if (hasClass) {
        return opening.replace(/\bclass="([^"]*)"/, 'class="$1 opacity-0"') + ">"
      }
      return opening + ' class="opacity-0">'
    }
  )
}

export function promoteFirstHeadingToH1(html: string): string {
  if (/<h1\b/i.test(html)) return html
  return html.replace(/<h([2-6])(\b[^>]*)>([\s\S]*?)<\/h\1>/i, '<h1$2>$3</h1>')
}

export function renderPageHtml(opts: RenderPageOptions): string {
  // LaTeX is converted to static MathML at build time by Temml,
  // so no client-side math library is needed.
  const mathScript = ""

  const answersScript =
    opts.activityAnswers && Object.keys(opts.activityAnswers).length > 0
      ? `\n    <script type="text/javascript">\n        window.correctAnswers = JSON.parse('${escapeInlineScriptJson(JSON.stringify(opts.activityAnswers))}');\n    </script>`
      : ""

  const normalizedContent = promoteFirstHeadingToH1(opts.content)

  // INVARIANT: every page MUST render all TTS-scannable content inside
  // <div id="content">. The reader's gatherAudioElements scans #content for
  // [data-id] elements to build the TTS queue; anything outside #content is
  // invisible to read-aloud. skipContentWrapper is only safe when the source
  // content already provides its own <div id="content"> wrapper.
  //
  // When content already has <div id="content"> (LLM-generated), use it directly to avoid
  // a duplicate #content element.
  // Inject opacity-0 into the existing wrapper for the fade-in animation (skip in embed mode).
  const contentAlreadyWrapped = /^\s*<div\b[^>]*\bid="content"/.test(normalizedContent)
  const contentBlock = opts.skipContentWrapper
    ? `      ${normalizedContent}`
    : contentAlreadyWrapped
      ? `      ${!opts.embed ? injectOpacityClass(normalizedContent) : normalizedContent}`
      : `      <div id="content"${opts.embed ? "" : ` class="opacity-0"`}>
        ${normalizedContent}
      </div>`

  const fallbackPageHeading = (opts.pageHeading ?? opts.pageTitle).trim()
  const fallbackHeadingHtml = /<h1\b/i.test(normalizedContent) || fallbackPageHeading.length === 0
    ? ""
    : `      <h1 class="sr-only" id="page-heading">${escapeHtml(fallbackPageHeading)}</h1>
`

  const mainBlock = `    <main class="w-full">
${fallbackHeadingHtml}${contentBlock}
    </main>`

  // Extract data-background-color from content to apply on <body>
  let bodyStyle = ""
  if (opts.applyBodyBackground !== false) {
    const bgMatch = normalizedContent.match(/data-background-color="([^"]*)"/)
    bodyStyle = bgMatch?.[1]
      ? ` style="background-color: ${escapeAttr(bgMatch[1])};"`
      : ""
  }

  // In embed mode, hide all interface chrome except the submit/reset buttons
  const embedStyles = opts.embed
    ? `
    <style>
      /* Hide navigation, sidebar, and other chrome in embed mode */
      #nav-container, #back-forward-buttons, #nav-popup,
      #open-sidebar, #sidebar, #tts-quick-toggle-button, #play-bar,
      #sl-quick-toggle-button, #sign-language-video,
      #explain-me-button, #eli5-content, #notepad-button, #notepad-content { display: none !important; }
      /* Keep submit/reset container fixed at bottom-right in embed mode */
      #submit-reset-container { position: fixed !important; bottom: 1rem; right: 1rem; z-index: 50; }
    </style>`
    : ""

  return `<!DOCTYPE html>
<html lang="${escapeAttr(opts.language)}">

<head>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1" name="viewport" />
    <title>${escapeHtml(opts.pageTitle)}</title>
    <meta name="title-id" content="${escapeAttr(opts.sectionId)}" />
    <meta name="page-section-id" content="${opts.pageIndex}" />
    <link rel="preload" href="./assets/fonts/Merriweather-VariableFont.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="./assets/fonts/Merriweather-Italic-VariableFont.woff2" as="font" type="font/woff2" crossorigin>
    <link href="./content/tailwind_output.css" rel="stylesheet">
    <link href="./assets/libs/fontawesome/css/all.min.css" rel="stylesheet">
    <link href="./assets/fonts.css" rel="stylesheet">
${mathScript}${embedStyles}</head>

<body class="min-h-screen flex items-center justify-center"${bodyStyle}>
${mainBlock}
${answersScript}
    <div class="relative z-50" id="interface-container"></div>
    <div class="relative z-50" id="nav-container"${opts.embed ? ' style="display:none"' : ""}></div>
${opts.embed
      ? `    <script src="./assets/base.bundle.min.js?v=${escapeAttr(opts.bundleVersion)}" type="module"></script>`
      : `    <script src="./assets/offline-preloader.js"></script>
    <script src="./assets/scorm.js"></script>
    <script src="./assets/base.bundle.local.js"></script>`}
</body>

</html>
`
}

// ---------------------------------------------------------------------------
// Quiz HTML generation
// ---------------------------------------------------------------------------

export function pad3(n: number): string {
  return String(n).padStart(3, "0")
}

export function getQuizQuestions(quiz: Quiz): QuizQuestion[] {
  if (quiz.questions && quiz.questions.length > 0) return quiz.questions
  return [{
    activityType: quiz.activityType ?? "multiple_choice",
    question: quiz.question,
    options: quiz.options,
    answerIndex: quiz.answerIndex,
    answerIndexes: quiz.answerIndexes,
    statements: quiz.statements,
    blanks: quiz.blanks,
    pairs: quiz.pairs,
    categories: quiz.categories,
    sortingItems: quiz.sortingItems,
    sampleAnswer: quiz.sampleAnswer,
    guidance: quiz.guidance,
    responseCharacterLimit: quiz.responseCharacterLimit,
    reasoning: quiz.reasoning,
  }]
}

export function getDefaultQuizTitle(activityType: QuizActivityType): string {
  switch (activityType) {
    case "multiple_select":
      return "Choose all that apply."
    case "true_false":
      return "True or false."
    case "fill_in_the_blank":
      return "Fill in the blanks."
    case "open_ended":
      return "Answer in your own words."
    case "drag_and_drop":
      return "Match the pairs."
    case "sorting":
      return "Sort the items."
    case "multiple_choice":
    default:
      return "Quiz."
  }
}

export function getSharedQuizTitle(
  questions: QuizQuestion[],
  activityType: QuizActivityType
): string {
  const first = questions[0]?.question?.trim()
  if (first && questions.every((q) => q.question.trim() === first)) return first
  return getDefaultQuizTitle(activityType)
}

function getExactSharedQuizTitle(questions: QuizQuestion[]): string | null {
  const first = questions[0]?.question?.trim()
  if (!first) return null
  return questions.every((q) => q.question.trim() === first) ? first : null
}

function getActivityTemplate(quiz: Quiz): ActivityTemplate {
  return quiz.template ?? {
    id: "worksheet-rows",
    name: "Worksheet rows",
    style: "worksheet_rows",
    generationMode: "template_single_page",
  }
}

function templateStyleFamily(template: ActivityTemplate): ActivityTemplate["style"] {
  switch (template.style) {
    case "clean_workbook":
      return "worksheet_rows"
    case "card_practice":
      return "practice_cards"
    case "compact_review":
      return "quick_check"
    default:
      return template.style
  }
}

function templateDataAttrs(template: ActivityTemplate): string {
  return `data-activity-template="${escapeAttr(template.name)}" data-activity-template-style="${escapeAttr(templateStyleFamily(template))}" data-activity-generation-mode="${escapeAttr(template.generationMode)}"`
}

function templateSurfaceClass(template: ActivityTemplate, accentClass: string): string {
  switch (templateStyleFamily(template)) {
    case "practice_cards":
      return `activity-template-surface mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-lg border border-white/70 ${accentClass} p-6 shadow-sm`
    case "quick_check":
      return "activity-template-surface mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm"
    case "guided_steps":
      return `activity-template-surface mx-auto flex w-full max-w-5xl flex-col gap-5 rounded-md border border-violet-200 ${accentClass} p-6 shadow-sm`
    case "worksheet_rows":
    default:
      return "activity-template-surface mx-auto flex w-full max-w-6xl flex-col gap-5 bg-white p-6"
  }
}

function templateWideSurfaceClass(template: ActivityTemplate, accentClass: string): string {
  return templateSurfaceClass(template, accentClass).replace(/max-w-(?:2xl|3xl|4xl|5xl|6xl)/, "max-w-7xl")
}

function templateTitleClass(template: ActivityTemplate): string {
  switch (templateStyleFamily(template)) {
    case "practice_cards":
      return "text-2xl font-bold text-slate-950"
    case "quick_check":
      return "text-left text-base font-bold uppercase tracking-wide text-blue-800"
    case "guided_steps":
      return "text-left text-xl font-bold text-violet-950"
    case "worksheet_rows":
    default:
      return "text-2xl font-bold text-slate-950"
  }
}

function templatePanelClass(template: ActivityTemplate): string {
  switch (templateStyleFamily(template)) {
    case "practice_cards":
      return "activity-template-panel space-y-3 rounded-lg border border-sky-100 bg-white/95 p-5 shadow-sm"
    case "quick_check":
      return "activity-template-panel space-y-2 rounded-md border border-slate-200 bg-slate-50/70 p-3"
    case "guided_steps":
      return "activity-template-panel space-y-3 rounded-md border border-violet-200 bg-white p-5 shadow-sm"
    case "worksheet_rows":
    default:
      return "activity-template-panel space-y-3 rounded-md border border-slate-200 bg-white p-4"
  }
}

function templateQuizGroupClass(template: ActivityTemplate): string {
  switch (templateStyleFamily(template)) {
    case "practice_cards":
      return "quiz-question-group activity-question-group mt-6 flex w-full flex-col items-stretch gap-4 sm:px-4"
    case "quick_check":
      return "quiz-question-group activity-question-group flex w-full flex-col gap-2 rounded-md border border-slate-200 bg-slate-50/70 p-3"
    case "guided_steps":
      return "quiz-question-group activity-question-group mt-5 flex w-full flex-col gap-3 rounded-md border border-violet-200 bg-white p-4 shadow-sm"
    case "worksheet_rows":
    default:
      return "quiz-question-group activity-question-group mt-6 flex w-full flex-col gap-3"
  }
}

function templateOptionLayoutClass(template: ActivityTemplate): string {
  switch (templateStyleFamily(template)) {
    case "practice_cards":
      return "activity-options-layout grid gap-4 md:grid-cols-2"
    case "quick_check":
      return "activity-options-layout grid gap-2 sm:grid-cols-2"
    case "guided_steps":
      return "activity-options-layout flex flex-col gap-2"
    case "worksheet_rows":
    default:
      return "activity-options-layout flex flex-col gap-3"
  }
}

function templateOptionClass(template: ActivityTemplate): string {
  switch (templateStyleFamily(template)) {
    case "practice_cards":
      return "activity-option flex min-h-24 w-full cursor-pointer flex-col justify-center rounded-lg border-2 border-sky-200 bg-white px-5 py-4 text-center text-base font-semibold text-slate-900 shadow-sm transition-colors hover:border-sky-400"
    case "quick_check":
      return "activity-option w-full cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-slate-900 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
    case "guided_steps":
      return "activity-option w-full cursor-pointer rounded-md border border-violet-200 bg-white px-4 py-3 text-left text-base font-medium text-slate-900 transition-colors hover:border-violet-500"
    case "worksheet_rows":
    default:
      return "activity-option w-full cursor-pointer rounded-md border border-slate-300 bg-white px-4 py-3 text-left text-base font-medium text-slate-900 transition-colors hover:bg-slate-50"
  }
}

function templateOptionTextClass(template: ActivityTemplate): string {
  switch (templateStyleFamily(template)) {
    case "practice_cards":
      return "option-text block text-base md:text-lg text-slate-900"
    case "quick_check":
      return "option-text block text-sm leading-snug text-slate-900"
    case "guided_steps":
    case "worksheet_rows":
    default:
      return "option-text block text-base text-slate-900"
  }
}

function templateQuestionEyebrowClass(template: ActivityTemplate): string {
  switch (templateStyleFamily(template)) {
    case "practice_cards":
      return "text-sm font-semibold uppercase tracking-wide text-sky-700"
    case "quick_check":
      return "text-xs font-bold uppercase tracking-wide text-blue-700"
    case "guided_steps":
      return "text-sm font-bold uppercase tracking-wide text-violet-700"
    case "worksheet_rows":
    default:
      return "text-sm font-semibold uppercase tracking-wide text-gray-500"
  }
}

function templateQuestionTextClass(template: ActivityTemplate, nested = false): string {
  switch (templateStyleFamily(template)) {
    case "practice_cards":
      return "text-xl font-bold text-slate-950"
    case "quick_check":
      return "text-base font-semibold text-slate-950"
    case "guided_steps":
      return "text-xl font-bold leading-tight text-violet-950"
    case "worksheet_rows":
    default:
      return nested ? "text-base font-semibold text-gray-900" : "text-xl font-semibold text-gray-900"
  }
}

function templateHasVisibleStepBadge(template: ActivityTemplate): boolean {
  return templateStyleFamily(template) === "guided_steps"
}

function renderQuestionEyebrowHtml(template: ActivityTemplate, questionIndex: number): string {
  if (templateHasVisibleStepBadge(template)) return ""
  return `<p class="${templateQuestionEyebrowClass(template)}">Q${questionIndex + 1}</p>`
}

function activityContentClass(): string {
  return "container content activity-content mx-auto flex min-h-screen w-full max-w-none items-start justify-center px-4 py-4 opacity-0"
}

function templateSelectedOptionCss(template: ActivityTemplate): string {
  switch (templateStyleFamily(template)) {
    case "practice_cards":
      return `
    .activity-option.selected-option {
        border-color: #0284c7;
        background-color: #e0f2fe;
        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.18);
    }`
    case "quick_check":
      return `
    .activity-option.selected-option {
        border-color: #2563eb;
        background-color: #eff6ff;
    }`
    case "guided_steps":
      return `
    .activity-option.selected-option {
        border-color: #7c3aed;
        background-color: #f5f3ff;
        box-shadow: inset 4px 0 0 #7c3aed;
    }`
    case "worksheet_rows":
    default:
      return `
    .activity-option.selected-option {
        border-color: #2563eb;
        background-color: #eff6ff;
    }`
  }
}

function activityTemplateCss(): string {
  return `
    #content.activity-content {
        align-items: flex-start;
        max-width: none;
        min-height: 100dvh;
        padding: clamp(1rem, 2.5vw, 2.5rem);
        width: 100%;
    }

    #content.activity-content #simple-main {
        width: 100%;
    }

    #content.activity-content .activity-content-frame {
        padding: 0;
        width: 100%;
    }

    #simple-main .activity-template-surface,
    #simple-main .activity-template-panel,
    #simple-main .activity-question-group,
    #simple-main .activity-option {
        box-sizing: border-box;
    }

    #simple-main .activity-options-layout {
        width: 100%;
    }

    #simple-main .activity-option-image,
    #simple-main .activity-item-image {
        display: block;
        max-width: 100%;
    }

    #simple-main .activity-template-surface {
        gap: clamp(1rem, 2vw, 1.75rem);
        max-width: min(100%, 74rem);
        padding: clamp(1.25rem, 2.5vw, 2.75rem);
        width: 100%;
    }

    #simple-main[data-section-type='activity_sorting'] .activity-template-surface {
        max-width: min(100%, 84rem);
    }

    #simple-main[data-section-type='activity_matching'] .activity-template-surface {
        max-width: min(100%, 78rem);
    }

    #simple-main[data-section-type='activity_fill_in_the_blank'] .activity-template-surface {
        max-width: min(100%, 72rem);
    }

    #simple-main[data-section-type='activity_open_ended_answer'] .activity-template-surface {
        max-width: min(100%, 72rem);
    }

    #simple-main .activity-template-panel,
    #simple-main .activity-question-group {
        padding: clamp(1rem, 2vw, 1.75rem);
    }

    #simple-main .activity-option {
        font-size: clamp(1rem, 1.25vw, 1.25rem);
    }

    #simple-main .fitb-sentence {
        font-size: clamp(1.35rem, 2vw, 2rem);
        line-height: 1.75;
    }

    #simple-main .fitb-inline-input {
        font: inherit;
    }

    #simple-main .matching-bank,
    #simple-main .matching-row,
    #simple-main .word-card,
    #simple-main .category {
        font-size: clamp(0.95rem, 1.1vw, 1.125rem);
    }

    #simple-main[data-activity-template-style="worksheet_rows"] .activity-template-surface {
        background: #ffffff;
    }

    #simple-main[data-activity-template-style="worksheet_rows"] .activity-question-group {
        border-top: 1px solid #e2e8f0;
        padding-top: 1rem;
    }

    #simple-main[data-activity-template-style="worksheet_rows"] .activity-option {
        min-height: 3.25rem;
    }

    #simple-main[data-activity-template-style="practice_cards"] .activity-template-surface {
        background: linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%);
    }

    #simple-main[data-activity-template-style="practice_cards"] .activity-page-shell {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        width: 100%;
    }

    #simple-main[data-activity-template-style="practice_cards"] .activity-pages {
        display: flex;
        gap: 1rem;
        margin: -0.25rem;
        overflow-x: auto;
        overscroll-behavior-x: contain;
        padding: 0.25rem;
        scroll-behavior: smooth;
        scroll-snap-type: x mandatory;
        scrollbar-width: thin;
        width: 100%;
    }

    #simple-main[data-activity-template-style="practice_cards"] .activity-page {
        flex: 0 0 100%;
        scroll-snap-align: start;
        scroll-snap-stop: always;
        width: 100%;
    }

    #simple-main[data-activity-template-style="practice_cards"] .activity-page > .activity-question-group,
    #simple-main[data-activity-template-style="practice_cards"] .activity-page > .activity-template-panel {
        margin-top: 0;
    }

    #simple-main[data-activity-template-style="practice_cards"] .activity-page-status {
        align-self: center;
        border: 1px solid #bae6fd;
        border-radius: 9999px;
        background: #ffffff;
        color: #0369a1;
        font-size: 0.875rem;
        font-weight: 700;
        padding: 0.35rem 0.85rem;
    }

    #simple-main[data-activity-template-style="practice_cards"] .activity-page-nav {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        justify-content: center;
    }

    #simple-main[data-activity-template-style="practice_cards"] .activity-page-button {
        border: 1px solid #7dd3fc;
        border-radius: 9999px;
        background: #ffffff;
        color: #075985;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 700;
        min-width: 6rem;
        padding: 0.55rem 1rem;
    }

    #simple-main[data-activity-template-style="practice_cards"] .activity-page-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }

    #simple-main[data-activity-template-style="practice_cards"] .activity-page-dots {
        display: flex;
        gap: 0.4rem;
    }

    #simple-main[data-activity-template-style="practice_cards"] .activity-page-dot {
        align-items: center;
        border: 1px solid #bae6fd;
        border-radius: 9999px;
        background: #ffffff;
        color: #0369a1;
        cursor: pointer;
        display: inline-flex;
        font-size: 0.75rem;
        font-weight: 800;
        height: 1.75rem;
        justify-content: center;
        width: 1.75rem;
    }

    #simple-main[data-activity-template-style="practice_cards"] .activity-page-dot[aria-current="step"] {
        background: #0284c7;
        border-color: #0284c7;
        color: #ffffff;
    }

    #simple-main[data-activity-template-style="practice_cards"] .activity-options-layout {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
    }

    #simple-main[data-activity-template-style="practice_cards"] .activity-option,
    #simple-main[data-activity-template-style="practice_cards"] .activity-item {
        min-height: 6rem;
        justify-content: center;
        text-align: center;
    }

    #simple-main[data-activity-template-style="practice_cards"] .feedback-container {
        text-align: left;
    }

    #simple-main[data-activity-template-style="quick_check"] .activity-template-surface {
        border-top: 4px solid #2563eb;
        box-shadow: none;
    }

    #simple-main[data-activity-template-style="quick_check"] .activity-question-group {
        margin-top: 0.75rem;
        gap: 0.65rem;
    }

    #simple-main[data-activity-template-style="quick_check"] .activity-template-panel {
        border-left: 4px solid #2563eb;
        border-radius: 0.375rem;
        box-shadow: none;
        padding: 0.75rem;
    }

    #simple-main[data-activity-template-style="quick_check"] .activity-option {
        min-height: 0;
        padding: 0.55rem 0.75rem;
    }

    #simple-main[data-activity-template-style="quick_check"] .feedback-container {
        padding: 0.35rem 0.5rem;
        font-size: 0.8125rem;
    }

    #simple-main[data-activity-template-style="guided_steps"] .activity-template-surface {
        background: linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%);
        counter-reset: activity-step;
    }

    #simple-main[data-activity-template-style="guided_steps"] .activity-question-group,
    #simple-main[data-activity-template-style="guided_steps"] .activity-template-panel {
        position: relative;
        padding-left: 3.5rem;
    }

    #simple-main[data-activity-template-style="guided_steps"] .activity-question-group::before,
    #simple-main[data-activity-template-style="guided_steps"] .activity-template-panel::before {
        align-items: center;
        background: #7c3aed;
        border-radius: 9999px;
        color: #ffffff;
        content: attr(data-step-number);
        display: flex;
        font-size: 0.8rem;
        font-weight: 800;
        height: 1.75rem;
        justify-content: center;
        left: 1rem;
        line-height: 1;
        position: absolute;
        top: 1rem;
        width: 1.75rem;
    }

    #simple-main[data-activity-template-style="guided_steps"] .activity-option {
        border-left-width: 4px;
    }

    @media (max-width: 640px) {
        #simple-main[data-activity-template-style="practice_cards"] .activity-options-layout,
        #simple-main[data-activity-template-style="quick_check"] .activity-options-layout {
            grid-template-columns: 1fr;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        #simple-main[data-activity-template-style="practice_cards"] .activity-pages {
            scroll-behavior: auto;
        }
    }`
}

function shouldPageActivityQuestions(template: ActivityTemplate, questionCount: number): boolean {
  return templateStyleFamily(template) === "practice_cards" && questionCount > 1
}

function renderActivityQuestionPages(
  quizId: string,
  template: ActivityTemplate,
  questionHtml: string[],
): string {
  if (!shouldPageActivityQuestions(template, questionHtml.length)) {
    return questionHtml.join("\n")
  }

  const pageCount = questionHtml.length
  const pagesId = `${quizId}-activity-pages`
  const statusId = `${quizId}-activity-page-status`
  const dotsHtml = questionHtml.map((_, index) => `
                    <button
                        type="button"
                        class="activity-page-dot"
                        data-activity-page-dot="${index}"
                        aria-label="Go to question ${index + 1}"
                        ${index === 0 ? 'aria-current="step"' : ""}
                    >${index + 1}</button>`).join("")

  const pagesHtml = questionHtml.map((html, index) => `
                    <article
                        class="activity-page"
                        data-activity-page
                        data-activity-page-index="${index}"
                        data-active="${index === 0 ? "true" : "false"}"
                        aria-label="Question ${index + 1} of ${pageCount}"
                    >
${html}
                    </article>`).join("\n")

  return `
                <div class="activity-page-shell" data-activity-page-shell>
                    <p id="${escapeAttr(statusId)}" class="activity-page-status" data-activity-page-status aria-live="polite">Question 1 of ${pageCount}</p>
                    <div
                        id="${escapeAttr(pagesId)}"
                        class="activity-pages"
                        data-activity-pages
                        tabindex="0"
                        role="group"
                        aria-describedby="${escapeAttr(statusId)}"
                    >
${pagesHtml}
                    </div>
                    <div class="activity-page-nav" data-activity-page-nav aria-controls="${escapeAttr(pagesId)}">
                        <button type="button" class="activity-page-button" data-activity-page-prev aria-label="Previous question">Previous</button>
                        <div class="activity-page-dots" role="group" aria-label="Questions">
${dotsHtml}
                        </div>
                        <button type="button" class="activity-page-button" data-activity-page-next aria-label="Next question">Next</button>
                    </div>
                </div>`
}

function renderNestedQuestionHeading(
  quizId: string,
  question: QuizQuestion,
  questionIndex: number,
  questions: QuizQuestion[],
  texts: Map<string, string>,
  template: ActivityTemplate,
): string {
  if (questions.length <= 1) return ""
  const titleId = `${quizId}_q${questionIndex + 1}_que`
  const title = texts.get(titleId) ?? question.question.trim()
  const showTitle = getExactSharedQuizTitle(questions) === null && title.length > 0
  const eyebrowHtml = renderQuestionEyebrowHtml(template, questionIndex)
  if (!eyebrowHtml && !showTitle) return ""
  return `
                    <div class="space-y-1">
                        ${eyebrowHtml}
                        ${showTitle ? `<p class="${templateQuestionTextClass(template, true)}" data-id="${escapeAttr(titleId)}">${escapeHtml(title)}</p>` : ""}
                    </div>`
}

export function getQuestionPrefix(
  quizId: string,
  questionIndex: number,
  multiQuestion: boolean,
): string {
  return multiQuestion ? `${quizId}_q${questionIndex + 1}` : quizId
}

export interface RenderQuizHtmlOptions {
  imageSrc?: (imageId: string) => string | null | undefined
}

function defaultQuizImageSrc(imageId: string): string {
  return `images/${imageId}`
}

function resolveQuizImageSrc(
  image: QuizImageAsset | undefined,
  options?: RenderQuizHtmlOptions,
): string | null {
  if (!image?.imageId) return null
  return options?.imageSrc?.(image.imageId) ?? defaultQuizImageSrc(image.imageId)
}

function renderQuizImageHtml(
  image: QuizImageAsset | undefined,
  options: RenderQuizHtmlOptions | undefined,
  className: string,
): string {
  const src = resolveQuizImageSrc(image, options)
  if (!src) return ""
  return `<img src="${escapeAttr(src)}" alt="${escapeAttr(image?.alt ?? "")}" class="${className}" loading="lazy" />`
}

export function collectQuizImageIds(quiz: Quiz): string[] {
  const imageIds: string[] = []
  const add = (image: QuizImageAsset | undefined) => {
    if (image?.imageId && !imageIds.includes(image.imageId)) imageIds.push(image.imageId)
  }
  for (const question of getQuizQuestions(quiz)) {
    for (const option of question.options ?? []) add(option.image)
    for (const pair of question.pairs ?? []) {
      add(pair.itemImage)
      add(pair.matchImage)
    }
    for (const item of question.sortingItems ?? []) add(item.image)
  }
  return imageIds
}

function textById(catalog: TextCatalogOutput | undefined): Map<string, string> {
  const texts = new Map<string, string>()
  if (catalog?.entries) {
    for (const e of catalog.entries) texts.set(e.id, e.text)
  }
  return texts
}

function blankPromptHtml(prompt: string, itemId: string): string {
  if (prompt.includes("[[blank:")) return escapeHtml(prompt)
  return escapeHtml(prompt).replace("____", `[[blank:${itemId}]]`)
}

export function renderQuizHtml(
  quiz: Quiz,
  quizId: string,
  catalog: TextCatalogOutput | undefined,
  options?: RenderQuizHtmlOptions,
): string {
  const questions = getQuizQuestions(quiz)
  const activityType = questions[0]?.activityType ?? "multiple_choice"
  if (activityType === "multiple_select") {
    return renderMultipleChoiceQuizHtml(quiz, quizId, catalog, "multiple", options)
  }
  if (activityType === "fill_in_the_blank") {
    return renderFillBlankQuizHtml(quiz, quizId, catalog)
  }
  if (activityType === "open_ended") {
    return renderOpenEndedQuizHtml(quiz, quizId, catalog)
  }
  if (activityType === "true_false") {
    return renderTrueFalseQuizHtml(quiz, quizId, catalog)
  }
  if (activityType === "drag_and_drop") {
    return renderMatchingQuizHtml(quiz, quizId, catalog, options)
  }
  if (activityType === "sorting") {
    return renderSortingQuizHtml(quiz, quizId, catalog, options)
  }
  return renderMultipleChoiceQuizHtml(quiz, quizId, catalog, "single", options)
}

function renderMultipleChoiceQuizHtml(
  quiz: Quiz,
  quizId: string,
  catalog: TextCatalogOutput | undefined,
  selectionMode: "single" | "multiple" = "single",
  renderOptions?: RenderQuizHtmlOptions,
): string {
  const questions = getQuizQuestions(quiz)
  const multiQuestion = questions.length > 1
  const isMultipleSelect = selectionMode === "multiple"
  const template = getActivityTemplate(quiz)
  const questionId = `${quizId}_que`
  const texts = textById(catalog)
  const titleText = texts.get(questionId) ?? getSharedQuizTitle(
    questions,
    isMultipleSelect ? "multiple_select" : "multiple_choice"
  )

  const correctAnswers: Record<string, boolean> = {}
  const explanationMapping: Record<string, string> = {}
  const groupHtml: string[] = []

  questions.forEach((question, questionIndex) => {
    const prefix = getQuestionPrefix(quizId, questionIndex, multiQuestion)
    const promptId = multiQuestion ? `${prefix}_que` : questionId
    const promptText = texts.get(promptId) ?? question.question
    const promptLabelId = multiQuestion ? `${promptId}-question-label` : `${quizId}-question-label`
    const promptHtml = multiQuestion
      ? `${renderQuestionEyebrowHtml(template, questionIndex)}
                    <p
                        id="${escapeAttr(promptId)}-question-label"
                        class="${templateQuestionTextClass(template)}"
                        data-id="${escapeAttr(promptId)}"
                    >
                        ${escapeHtml(promptText)}
                    </p>`
      : ""
    let optionsHtml = ""
    const options = question.options ?? []
    const answerIndexes = new Set(question.answerIndexes ?? [])
    for (let i = 0; i < options.length; i++) {
      const optionId = `${prefix}_o${i}`
      correctAnswers[optionId] = isMultipleSelect
        ? answerIndexes.has(i)
        : i === question.answerIndex

      const expId = `${optionId}_exp`
      if (texts.has(expId)) {
        explanationMapping[optionId] = expId
      }

      const optionText = texts.get(optionId) ?? options[i].text
      const expIdMapped = explanationMapping[optionId]
      const expText = expIdMapped ? (texts.get(expIdMapped) ?? options[i].explanation) : ""
      const expIdAttr = expIdMapped ? ` data-explanation-id="${escapeAttr(expIdMapped)}"` : ""
      const optionImageHtml = renderQuizImageHtml(
        options[i].image,
        renderOptions,
        "activity-option-image mb-3 max-h-36 w-full rounded-md object-contain"
      )

      optionsHtml += `
                    <label
                        class="${templateOptionClass(template)}"
                        data-activity-item="${escapeAttr(optionId)}"
                        data-quiz-question-group="${escapeAttr(prefix)}"
                        data-explanation="${escapeAttr(expText)}"${expIdAttr}
                        tabindex="0"
                    >
                        <input
                            type="${isMultipleSelect ? "checkbox" : "radio"}"
                            name="${escapeAttr(prefix)}"
                            value="${escapeAttr(optionId)}"
                            data-activity-item="${escapeAttr(optionId)}"
                            data-quiz-question-group="${escapeAttr(prefix)}"
                            class="sr-only"
                            aria-labelledby="${escapeAttr(optionId)}-option-label"
                        />
                        ${optionImageHtml}
                        <span
                            id="${escapeAttr(optionId)}-option-label"
                            class="${templateOptionTextClass(template)}"
                            data-id="${escapeAttr(optionId)}"
                        >
                            ${escapeHtml(optionText)}
                        </span>

                        <div class="feedback-container hidden w-full rounded-md border border-transparent bg-transparent px-3 py-2 text-gray-700" aria-live="polite">
                            <span aria-hidden="true" class="feedback-icon mr-2"></span>
                            <span class="feedback-text"></span>
                        </div>

                        <span class="validation-mark hidden"></span>
                    </label>`
    }
    groupHtml.push(`
                <div
                    class="${templateQuizGroupClass(template)}"
                    role="group"
                    data-step-number="${questionIndex + 1}"
                    data-quiz-question-group="${escapeAttr(prefix)}"
                    data-quiz-selection-mode="${isMultipleSelect ? "multiple" : "single"}"
                    aria-labelledby="${escapeAttr(promptLabelId)}"
                >
                    ${promptHtml}
                    <div class="${templateOptionLayoutClass(template)}">
${optionsHtml}
                    </div>
                </div>`)
  })
  const groupsHtml = renderActivityQuestionPages(quizId, template, groupHtml)

  return `<style>
${activityTemplateCss()}

${templateSelectedOptionCss(template)}

    .activity-option.selected-option .option-text {
        color: #1e3a8a;
        font-weight: 600;
    }
</style>

<div id="content" class="${activityContentClass()}">
    <section
        id="simple-main"
        data-section-type="activity_quiz"
        data-id="${escapeAttr(quizId)}"
        data-area-id="${escapeAttr(quizId)}"
        data-quiz-selection-mode="${isMultipleSelect ? "multiple" : "single"}"
        ${templateDataAttrs(template)}
        data-correct-answers='${escapeAttr(JSON.stringify(correctAnswers))}'
        data-option-explanations='${escapeAttr(JSON.stringify(explanationMapping))}'
    >
        <div class="activity-content-frame flex w-full flex-col items-center px-0 py-0">
            <div class="${templateSurfaceClass(template, "bg-blue-50")}">
                <header class="text-center">
                    <h1
                        id="${escapeAttr(quizId)}-question-label"
                        class="${templateTitleClass(template)}"
                        data-id="${escapeAttr(questionId)}"
                    >
                        ${escapeHtml(titleText)}
                    </h1>
                </header>
${groupsHtml}

                <div class="mt-10 flex flex-col items-center gap-4">
                    <div data-submit-target class="flex flex-wrap items-center justify-center gap-4"></div>
                </div>

            </div>
        </div>
    </section>
</div>

<script type="application/json" id="quiz-correct-answers">
${JSON.stringify(correctAnswers)}
</script>
<script type="application/json" id="quiz-explanations">
${JSON.stringify(explanationMapping)}
</script>`
}

function renderFillBlankQuizHtml(
  quiz: Quiz,
  quizId: string,
  catalog: TextCatalogOutput | undefined,
): string {
  const texts = textById(catalog)
  const questions = getQuizQuestions(quiz)
  const template = getActivityTemplate(quiz)
  const titleId = `${quizId}_que`
  const title = texts.get(titleId) ?? getSharedQuizTitle(questions, "fill_in_the_blank")
  let itemIndex = 1
  const questionHtml = questions.map((question, questionIndex) => {
    const headingHtml = renderNestedQuestionHeading(
      quizId,
      question,
      questionIndex,
      questions,
      texts,
      template
    )
    const blanksHtml = (question.blanks ?? []).map((blank, blankIndex) => {
      const textId = questions.length > 1
        ? `${quizId}_q${questionIndex + 1}_blank${blankIndex}`
        : `${quizId}_blank${blankIndex}`
      const itemId = `item-${itemIndex++}`
      const prompt = texts.get(textId) ?? blank.prompt
      return `<p class="fitb-sentence text-lg leading-relaxed" data-id="${escapeAttr(textId)}">${blankPromptHtml(prompt, itemId)}</p>`
    }).join("\n")
    return `
                <div class="${templatePanelClass(template)}" data-step-number="${questionIndex + 1}">
${headingHtml}
${blanksHtml}
                </div>`
  })
  const questionsHtml = renderActivityQuestionPages(quizId, template, questionHtml)

  return `<style>
${activityTemplateCss()}
</style>

<div id="content" class="${activityContentClass()}">
    <section id="simple-main" data-section-type="activity_fill_in_the_blank" data-id="${escapeAttr(quizId)}" data-area-id="${escapeAttr(quizId)}" ${templateDataAttrs(template)}>
        <div class="${templateSurfaceClass(template, "bg-emerald-50")}">
            <h1 class="${templateTitleClass(template)}" data-id="${escapeAttr(titleId)}">${escapeHtml(title)}</h1>
${questionsHtml}
            <div data-submit-target class="flex flex-wrap items-center justify-center gap-4"></div>
        </div>
    </section>
</div>`
}

function renderOpenEndedQuizHtml(
  quiz: Quiz,
  quizId: string,
  catalog: TextCatalogOutput | undefined,
): string {
  const texts = textById(catalog)
  const questions = getQuizQuestions(quiz)
  const template = getActivityTemplate(quiz)
  const titleId = `${quizId}_que`
  const title = texts.get(titleId) ?? getSharedQuizTitle(questions, "open_ended")
  const questionHtml = questions.map((question, questionIndex) => {
    const prefix = getQuestionPrefix(quizId, questionIndex, questions.length > 1)
    const promptId = questions.length > 1 ? `${prefix}_que` : titleId
    const inputId = `${prefix}_answer`
    const promptText = texts.get(promptId) ?? question.question
    const responseLimit = question.responseCharacterLimit && question.responseCharacterLimit > 0
      ? Math.trunc(question.responseCharacterLimit)
      : null
    const responseLimitAttrs = responseLimit
      ? ` maxlength="${responseLimit}" data-character-limit="${responseLimit}"`
      : ""
    const headingHtml = renderNestedQuestionHeading(
      quizId,
      { ...question, question: promptText },
      questionIndex,
      questions,
      texts,
      template
    )
    const singlePromptHtml = questions.length === 1 ? "" : headingHtml
    return `
                <div class="${templatePanelClass(template)}" data-step-number="${questionIndex + 1}">
${singlePromptHtml}
                    <label class="block space-y-2" for="${escapeAttr(inputId)}">
                        <span id="${escapeAttr(inputId)}-label" class="sr-only">${escapeHtml(promptText)}</span>
                        <textarea
                            id="${escapeAttr(inputId)}"
                            data-aria-id="${escapeAttr(inputId)}"
                            data-activity-item="${escapeAttr(inputId)}"
                            aria-labelledby="${escapeAttr(inputId)}-label"
                            ${responseLimitAttrs}
                            class="open-ended-response min-h-40 w-full resize-y rounded-md border border-slate-300 bg-white p-4 text-base leading-relaxed text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            rows="6"
                        ></textarea>
                    </label>
                </div>`
  })
  const questionsHtml = renderActivityQuestionPages(quizId, template, questionHtml)

  return `<style>
${activityTemplateCss()}

    #simple-main .open-ended-response {
        font-family: inherit;
    }
</style>

<div id="content" class="${activityContentClass()}">
    <section id="simple-main" data-section-type="activity_open_ended_answer" data-id="${escapeAttr(quizId)}" data-area-id="${escapeAttr(quizId)}" ${templateDataAttrs(template)}>
        <div class="${templateSurfaceClass(template, "bg-fuchsia-50")}">
            <h1 id="${escapeAttr(quizId)}-question-label" class="${templateTitleClass(template)}" data-id="${escapeAttr(titleId)}">${escapeHtml(title)}</h1>
${questionsHtml}
            <div data-submit-target class="flex flex-wrap items-center justify-center gap-4"></div>
        </div>
    </section>
</div>`
}

function renderTrueFalseQuizHtml(
  quiz: Quiz,
  quizId: string,
  catalog: TextCatalogOutput | undefined,
): string {
  const texts = textById(catalog)
  const questions = getQuizQuestions(quiz)
  const template = getActivityTemplate(quiz)
  const titleId = `${quizId}_que`
  const title = texts.get(titleId) ?? getSharedQuizTitle(questions, "true_false")
  let itemIndex = 1
  const questionHtml = questions.map((question, questionIndex) => {
    const headingHtml = renderNestedQuestionHeading(
      quizId,
      question,
      questionIndex,
      questions,
      texts,
      template
    )
    const rowsHtml = (question.statements ?? []).map((statement, statementIndex) => {
      const itemId = `item-${itemIndex}`
      const stepNumber = itemIndex
      const textId = questions.length > 1
        ? `${quizId}_q${questionIndex + 1}_tf${statementIndex}`
        : `${quizId}_tf${statementIndex}`
      const text = texts.get(textId) ?? statement.text
      const name = `question${itemIndex}`
      itemIndex++
      return `
                    <fieldset class="${templatePanelClass(template)}" data-step-number="${stepNumber}">
                        <legend class="text-base font-semibold text-gray-900">
                            <span data-id="${escapeAttr(textId)}">${escapeHtml(text)}</span>
                        </legend>
                        <div class="flex flex-wrap gap-3">
                            <label class="cursor-pointer">
                                <input class="sr-only peer" type="radio" name="${escapeAttr(name)}" value="true" data-activity-item="${escapeAttr(itemId)}" aria-label="True" />
                                <div class="choice-chip rounded-full bg-orange-100 px-5 py-2 text-sm font-bold text-orange-900 peer-checked:bg-orange-600 peer-checked:text-white">T<span class="validation-mark hidden"></span></div>
                            </label>
                            <label class="cursor-pointer">
                                <input class="sr-only peer" type="radio" name="${escapeAttr(name)}" value="false" data-activity-item="${escapeAttr(itemId)}" aria-label="False" />
                                <div class="choice-chip rounded-full bg-orange-100 px-5 py-2 text-sm font-bold text-orange-900 peer-checked:bg-orange-600 peer-checked:text-white">F<span class="validation-mark hidden"></span></div>
                            </label>
                        </div>
                    </fieldset>`
    }).join("\n")
    return `
                <div class="space-y-3">
${headingHtml}
${rowsHtml}
                </div>`
  })
  const questionsHtml = renderActivityQuestionPages(quizId, template, questionHtml)

  return `<style>
${activityTemplateCss()}
</style>

<div id="content" class="${activityContentClass()}">
    <section id="simple-main" data-section-type="activity_true_false" data-id="${escapeAttr(quizId)}" data-area-id="${escapeAttr(quizId)}" ${templateDataAttrs(template)}>
        <div class="${templateSurfaceClass(template, "bg-orange-50")}">
            <h1 class="${templateTitleClass(template)}" data-id="${escapeAttr(titleId)}">${escapeHtml(title)}</h1>
${questionsHtml}
            <div data-submit-target class="flex flex-wrap items-center justify-center gap-4"></div>
        </div>
    </section>
</div>`
}

function renderMatchingQuizHtml(
  quiz: Quiz,
  quizId: string,
  catalog: TextCatalogOutput | undefined,
  renderOptions?: RenderQuizHtmlOptions,
): string {
  const texts = textById(catalog)
  const questions = getQuizQuestions(quiz)
  const template = getActivityTemplate(quiz)
  const titleId = `${quizId}_que`
  const title = texts.get(titleId) ?? getSharedQuizTitle(questions, "drag_and_drop")
  let itemIndex = 1
  let itemsHtml = ""
  const groupHtml: string[] = []

  questions.forEach((question, questionIndex) => {
    const headingHtml = renderNestedQuestionHeading(
      quizId,
      question,
      questionIndex,
      questions,
      texts,
      template
    )
    let groupDropzones = ""
    ;(question.pairs ?? []).forEach((pair, pairIndex) => {
      const itemId = `item-${itemIndex}`
      const dropzoneId = `dropzone-${itemIndex}`
      const itemTextId = questions.length > 1
        ? `${quizId}_q${questionIndex + 1}_pair${pairIndex}`
        : `${quizId}_pair${pairIndex}`
      const matchTextId = questions.length > 1
        ? `${quizId}_q${questionIndex + 1}_match${pairIndex}`
        : `${quizId}_match${pairIndex}`
      const itemImageHtml = renderQuizImageHtml(
        pair.itemImage,
        renderOptions,
        "activity-item-image mb-2 max-h-24 w-full rounded object-contain"
      )
      const matchImageHtml = renderQuizImageHtml(
        pair.matchImage,
        renderOptions,
        "activity-item-image mb-2 max-h-28 w-full rounded object-contain"
      )
      itemsHtml += `<button type="button" class="activity-item rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm" data-activity-item="${escapeAttr(itemId)}" data-id="${escapeAttr(itemTextId)}">${itemImageHtml}<span>${escapeHtml(texts.get(itemTextId) ?? pair.item)}</span></button>\n`
      groupDropzones += `
                    <div class="matching-row dropzone grid gap-3 border-b border-slate-200 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,18rem)] sm:items-center" id="${escapeAttr(`zone-${itemIndex}`)}" aria-label="${escapeAttr(texts.get(matchTextId) ?? pair.match)}">
                        <div class="text-base font-semibold text-slate-900" data-id="${escapeAttr(matchTextId)}">${matchImageHtml}<span>${escapeHtml(texts.get(matchTextId) ?? pair.match)}</span></div>
                        <div id="${escapeAttr(dropzoneId)}" class="dropzone-slot flex min-h-11 items-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500"></div>
                    </div>`
      itemIndex++
    })
    groupHtml.push(`
                <div class="${templatePanelClass(template)}" data-step-number="${questionIndex + 1}">
${headingHtml}
                    <div class="rounded-lg border border-slate-200 bg-white px-4">
${groupDropzones}
                    </div>
                </div>`)
  })
  const groupsHtml = renderActivityQuestionPages(quizId, template, groupHtml)

  return `<style>
${activityTemplateCss()}

    #simple-main .matching-bank:not(:has(.activity-item)) {
        display: none;
    }

    #simple-main .dropzone-slot:has(.activity-item) {
        border-style: solid;
        background: #ffffff;
        color: #0f172a;
    }

    #simple-main .dropzone-slot .activity-item {
        width: 100%;
        border: 0;
        background: transparent;
        box-shadow: none;
        padding: 0;
        color: #0f172a;
        text-align: left;
    }

    #simple-main .activity-item.placed-in-dropzone {
        transform: none;
    }
  </style>

<div id="content" class="${activityContentClass()}">
    <section id="simple-main" data-section-type="activity_matching" data-id="${escapeAttr(quizId)}" data-area-id="${escapeAttr(quizId)}" data-aria-id="${escapeAttr(quizId)}" ${templateDataAttrs(template)}>
        <div class="${templateSurfaceClass(template, "bg-indigo-50")}">
            <h1 class="${templateTitleClass(template)}" data-id="${escapeAttr(titleId)}">${escapeHtml(title)}</h1>
            <div class="matching-bank original-word-list flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
${itemsHtml}
            </div>
${groupsHtml}
            <div id="feedback" class="text-sm font-medium"></div>
            <div data-submit-target class="flex flex-wrap items-center justify-center gap-4"></div>
        </div>
    </section>
</div>`
}

function renderSortingQuizHtml(
  quiz: Quiz,
  quizId: string,
  catalog: TextCatalogOutput | undefined,
  renderOptions?: RenderQuizHtmlOptions,
): string {
  const texts = textById(catalog)
  const questions = getQuizQuestions(quiz)
  const template = getActivityTemplate(quiz)
  const titleId = `${quizId}_que`
  const title = texts.get(titleId) ?? getSharedQuizTitle(questions, "sorting")
  const categoryColors = [
    "bg-amber-50 border-amber-300",
    "bg-cyan-50 border-cyan-300",
    "bg-lime-50 border-lime-300",
    "bg-rose-50 border-rose-300",
    "bg-violet-50 border-violet-300",
  ]
  let itemIndex = 1

  const groupHtml = questions.map((question, questionIndex) => {
    const headingHtml = renderNestedQuestionHeading(
      quizId,
      question,
      questionIndex,
      questions,
      texts,
      template
    )
    const prefix = getQuestionPrefix(quizId, questionIndex, questions.length > 1)
    const itemsHtml = (question.sortingItems ?? []).map((item, itemOffset) => {
      const itemId = `item-${itemIndex++}`
      const textId = `${prefix}_sort${itemOffset}`
      const text = texts.get(textId) ?? item.item
      const itemImageHtml = renderQuizImageHtml(
        item.image,
        renderOptions,
        "activity-item-image mb-2 max-h-24 w-full rounded object-contain"
      )
      return `
                        <button
                            type="button"
                            class="word-card rounded-md border border-amber-300 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-800 shadow-sm cursor-pointer transition duration-300 hover:bg-amber-100 transform hover:scale-105"
                            data-activity-item="${escapeAttr(itemId)}"
                            data-id="${escapeAttr(textId)}"
                            draggable="true"
                            tabindex="0"
                            role="option"
                        >
                            ${itemImageHtml}
                            <span>${escapeHtml(text)}</span>
                        </button>`
    }).join("\n")

    const categoriesHtml = (question.categories ?? []).map((category, categoryIndex) => {
      const categoryId = `category-${questionIndex + 1}-${categoryIndex + 1}`
      const textId = `${prefix}_cat${categoryIndex}`
      const color = categoryColors[categoryIndex % categoryColors.length]
      return `
                        <div
                            class="category ${color} rounded-2xl border-2 border-dashed p-3 min-h-[9rem]"
                            data-activity-category="${escapeAttr(categoryId)}"
                            tabindex="0"
                            role="listbox"
                        >
                            <label class="block rounded-full bg-white/80 px-3 py-1 text-center text-sm font-semibold text-slate-900 shadow-sm" data-id="${escapeAttr(textId)}">${escapeHtml(texts.get(textId) ?? category.label)}</label>
                            <ul class="word-list mt-3 flex min-h-20 flex-wrap content-start gap-2"></ul>
                        </div>`
    }).join("\n")

    return `
                <div class="${templatePanelClass(template)}" data-step-number="${questionIndex + 1}">
${headingHtml}
                    <div class="rounded-2xl border border-amber-200 bg-amber-100/50 p-4">
                        <div class="flex flex-wrap justify-center gap-3" role="listbox">
${itemsHtml}
                        </div>
                    </div>
                    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="listbox">
${categoriesHtml}
                    </div>
                </div>`
  })
  const groupsHtml = renderActivityQuestionPages(quizId, template, groupHtml)

  return `<style>
${activityTemplateCss()}
</style>

<div id="content" class="${activityContentClass()}">
    <section id="simple-main" data-section-type="activity_sorting" data-id="${escapeAttr(quizId)}" data-area-id="${escapeAttr(quizId)}" data-aria-id="${escapeAttr(quizId)}" ${templateDataAttrs(template)}>
        <div class="${templateWideSurfaceClass(template, "bg-amber-50")}">
            <h1 class="${templateTitleClass(template)}" data-id="${escapeAttr(titleId)}">${escapeHtml(title)}</h1>
${groupsHtml}
            <div id="feedback" class="text-sm font-medium"></div>
            <div data-submit-target class="flex flex-wrap items-center justify-center gap-4"></div>
        </div>
    </section>
</div>`
}

export function buildQuizAnswers(quiz: Quiz, quizId: string): Record<string, string | boolean> {
  const answers: Record<string, string | boolean> = {}
  const questions = getQuizQuestions(quiz)
  const multiQuestion = questions.length > 1
  const activityType = questions[0]?.activityType ?? "multiple_choice"
  if (activityType === "multiple_choice") {
    questions.forEach((question, questionIndex) => {
      const prefix = getQuestionPrefix(quizId, questionIndex, multiQuestion)
      for (let i = 0; i < (question.options ?? []).length; i++) {
        answers[`${prefix}_o${i}`] = i === question.answerIndex
      }
    })
  } else if (activityType === "multiple_select") {
    questions.forEach((question, questionIndex) => {
      const prefix = getQuestionPrefix(quizId, questionIndex, multiQuestion)
      const answerIndexes = new Set(question.answerIndexes ?? [])
      for (let i = 0; i < (question.options ?? []).length; i++) {
        answers[`${prefix}_o${i}`] = answerIndexes.has(i)
      }
    })
  } else if (activityType === "fill_in_the_blank") {
    let itemIndex = 1
    for (const question of questions) {
      for (const blank of question.blanks ?? []) {
        answers[`item-${itemIndex++}`] = blank.answer
      }
    }
  } else if (activityType === "true_false") {
    let itemIndex = 1
    for (const question of questions) {
      for (const statement of question.statements ?? []) {
        answers[`item-${itemIndex++}`] = statement.answer ? "true" : "false"
      }
    }
  } else if (activityType === "drag_and_drop") {
    let itemIndex = 1
    for (const question of questions) {
      for (const _pair of question.pairs ?? []) {
        answers[`item-${itemIndex}`] = `dropzone-${itemIndex}`
        itemIndex++
      }
    }
  } else if (activityType === "sorting") {
    let itemIndex = 1
    questions.forEach((question, questionIndex) => {
      const categoryByLabel = new Map(
        (question.categories ?? []).map((category, categoryIndex) => [
          category.label.trim().toLowerCase(),
          `category-${questionIndex + 1}-${categoryIndex + 1}`,
        ])
      )
      for (const item of question.sortingItems ?? []) {
        answers[`item-${itemIndex}`] = categoryByLabel.get(item.category.trim().toLowerCase()) ?? ""
        itemIndex++
      }
    })
  }
  return answers
}

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------

/** Scan the images directory and build imageId → filename map */
export function buildImageMap(imagesDir: string): Map<string, string> {
  const map = new Map<string, string>()
  if (!fs.existsSync(imagesDir)) return map

  for (const file of fs.readdirSync(imagesDir)) {
    const ext = path.extname(file)
    if (ext === ".jpg" || ext === ".png") {
      const id = path.basename(file, ext)
      map.set(id, file)
    }
  }
  return map
}


function loadImageCaptionMap(storage: Storage, pageId: string): Map<string, string> {
  const row = storage.getLatestNodeData("image-captioning", pageId)
  if (!row) return new Map<string, string>()

  const data = row.data as ImageCaptioningOutput
  const map = new Map<string, string>()
  for (const caption of data.captions ?? []) {
    if (caption.caption?.trim()) {
      map.set(caption.imageId, caption.caption.trim())
    }
  }
  return map
}

/** Collect every non-pruned image_group node in a section along with its image id. */
function collectImageGroups(section: PageSectioningSection): Array<{ group: ContentNodeData; imageId: string }> {
  const out: Array<{ group: ContentNodeData; imageId: string }> = []
  const walk = (node: ContentNodeData): void => {
    if (node.isPruned) return
    if (node.structure === "image_group") {
      const imageLeaf = node.children?.find((c) => c.role === "image" && !c.isPruned)
      if (imageLeaf) out.push({ group: node, imageId: imageLeaf.nodeId })
    }
    if (node.children) {
      for (const c of node.children) walk(c)
    }
  }
  for (const n of section.nodes) walk(n)
  return out
}

/** Collect all non-pruned leaf texts matching a role within a subtree. */
function collectLeafTextsByRole(node: ContentNodeData, role: string): string[] {
  const out: string[] = []
  const walk = (n: ContentNodeData): void => {
    if (n.isPruned) return
    if (n.role === role && n.text) {
      const trimmed = n.text.replace(/\s+/g, " ").trim()
      if (trimmed.length > 0) out.push(trimmed)
    }
    if (n.children) {
      for (const c of n.children) walk(c)
    }
  }
  walk(node)
  return out
}

function buildSectionImageAltMap(section: PageSectioningSection): Map<string, string> {
  const imageGroups = collectImageGroups(section)
  const map = new Map<string, string>()
  if (imageGroups.length !== 1) return map

  const captions = collectLeafTextsByRole(imageGroups[0].group, "caption")
  if (captions.length === 0) return map

  map.set(imageGroups[0].imageId, captions.join(" "))
  return map
}

function applyDuplicateImageAltPolicy(
  section: PageSectioningSection,
  altTextByImageId: Map<string, string>,
): Map<string, string> {
  const normalizedAltToFirstImageId = new Map<string, string>()
  const normalizedAltMap = new Map(altTextByImageId)

  for (const { imageId } of collectImageGroups(section)) {
    const altText = normalizedAltMap.get(imageId)?.trim()
    if (!altText) continue

    const dedupeKey = altText.replace(/\s+/g, " ").trim().toLowerCase()
    if (!dedupeKey) continue

    if (normalizedAltToFirstImageId.has(dedupeKey)) {
      normalizedAltMap.set(imageId, "")
      continue
    }

    normalizedAltToFirstImageId.set(dedupeKey, imageId)
  }

  return normalizedAltMap
}

export function buildPreferredImageAltMap(
  storage: Storage,
  pageId: string,
  section?: PageSectioningSection,
): Map<string, string> {
  const imageCaptionMap = loadImageCaptionMap(storage, pageId)
  const sectionImageAltMap = section ? buildSectionImageAltMap(section) : new Map<string, string>()
  const preferredImageAltMap = new Map(sectionImageAltMap)
  for (const [imageId, altText] of imageCaptionMap) {
    preferredImageAltMap.set(imageId, altText)
  }
  return section ? applyDuplicateImageAltPolicy(section, preferredImageAltMap) : preferredImageAltMap
}

export function normalizeSectionRoles(html: string): string {
  return normalizeHtmlSectionSemantics(html)
}

/** Rewrite image URLs from /api/books/{label}/images/{id} to images/{filename} */
export function rewriteImageUrls(
  html: string,
  label: string,
  imageMap: Map<string, string>,
  altTextByImageId?: Map<string, string>,
): { html: string; referencedImages: string[] } {
  const prefix = `/api/books/${label}/images/`
  const referencedImages: string[] = []
  const doc = parseDocument(normalizeSectionRoles(html))

  const imgs = DomUtils.findAll(
    (el) => el.type === "tag" && el.name === "img",
    doc.children,
  )

  for (const img of imgs) {
    let resolvedImageId: string | undefined
    const src = img.attribs.src ?? ""
    if (src.startsWith(prefix)) {
      const imageId = src.slice(prefix.length)
      const filename = imageMap.get(imageId)
      if (filename) {
        resolvedImageId = imageId
        img.attribs.src = `images/${filename}`
        referencedImages.push(imageId)
        delete img.attribs.width
        delete img.attribs.height
        const existingStyle = img.attribs.style ?? ""
        const sizeStyle = "max-width: 100%; height: auto;"
        if (!existingStyle.includes("max-width")) {
          img.attribs.style = existingStyle
            ? `${existingStyle.trimEnd().replace(/;$/, "")}; ${sizeStyle}`
            : sizeStyle
        }
      }
    }
    // Also handle data-id based images
    const dataId = img.attribs["data-id"]
    if (dataId && imageMap.has(dataId) && !img.attribs.src?.startsWith("images/")) {
      const filename = imageMap.get(dataId)!
      resolvedImageId = dataId
      img.attribs.src = `images/${filename}`
      if (!referencedImages.includes(dataId)) {
        referencedImages.push(dataId)
      }
      delete img.attribs.width
      delete img.attribs.height
      const existingStyle = img.attribs.style ?? ""
      const sizeStyle = "max-width: 100%; height: auto;"
      if (!existingStyle.includes("max-width")) {
        img.attribs.style = existingStyle
          ? `${existingStyle.trimEnd().replace(/;$/, "")}; ${sizeStyle}`
          : sizeStyle
      }
    }

    const imageIdForAlt = resolvedImageId ?? dataId
    const hasPreferredAlt = imageIdForAlt ? altTextByImageId?.has(imageIdForAlt) ?? false : false
    const altText = imageIdForAlt ? altTextByImageId?.get(imageIdForAlt)?.trim() ?? "" : ""
    if (hasPreferredAlt && (img.attribs.alt === undefined || img.attribs.alt.trim() === "")) {
      img.attribs.alt = altText
    }
  }

  const normalizedHtml = DomUtils.getOuterHTML(doc).replace(/(<img\b[^>]*?)\salt(?=[\s>])/g, "$1 alt=\"\"")
  return { html: normalizedHtml, referencedImages }
}

/**
 * Convert an HTML fragment to well-formed XHTML.
 * Uses htmlparser2 to parse and re-serialize in XML mode, and replaces
 * HTML named entities with their numeric equivalents.
 */
export function htmlToXhtml(html: string): string {
  const doc = parseDocument(html)
  let xhtml = DomUtils.getOuterHTML(doc, { xmlMode: true })
  // Replace common HTML named entities not valid in XML
  xhtml = xhtml.replace(/&nbsp;/g, "&#160;")
  xhtml = xhtml.replace(/&mdash;/g, "&#8212;")
  xhtml = xhtml.replace(/&ndash;/g, "&#8211;")
  xhtml = xhtml.replace(/&lsquo;/g, "&#8216;")
  xhtml = xhtml.replace(/&rsquo;/g, "&#8217;")
  xhtml = xhtml.replace(/&ldquo;/g, "&#8220;")
  xhtml = xhtml.replace(/&rdquo;/g, "&#8221;")
  xhtml = xhtml.replace(/&hellip;/g, "&#8230;")
  xhtml = xhtml.replace(/&bull;/g, "&#8226;")
  xhtml = xhtml.replace(/&copy;/g, "&#169;")
  return xhtml
}

// ---------------------------------------------------------------------------
// Glossary helpers
// ---------------------------------------------------------------------------

export function buildGlossaryJson(
  glossary: GlossaryOutput | undefined,
  catalog: TextCatalogOutput | undefined,
  textsMap: Record<string, string>,
  isSourceLanguage: boolean,
): Record<string, { word: string; definition: string; variations: string[]; emoji: string }> {
  if (!glossary?.items) return {}

  const result: Record<string, { word: string; definition: string; variations: string[]; emoji: string }> = {}

  for (let i = 0; i < glossary.items.length; i++) {
    const item = glossary.items[i]
    if (item.pruned) continue
    const glId = getGlossaryItemTextId(item, i)
    const defId = `${glId}_def`

    // Use translated text if available, otherwise fall back to source
    const word = textsMap[glId] ?? item.word
    const definition = textsMap[defId] ?? item.definition

    result[word] = {
      word,
      definition,
      variations: item.variations,
      emoji: item.emojis.join(""),
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Math detection
// ---------------------------------------------------------------------------

const MATH_INDICATORS = [
  "$",
  "\\(",
  "\\[",
  "<math",
  "\\begin{",
  // HTML-encoded forms (htmlparser2's getOuterHTML encodes $ as &#x24;)
  "&#x24;",
]

/**
 * Regex that matches LaTeX commands commonly found undelimited in LLM output.
 * Matches: \text{}, \hat{}, \frac{}{}, \sqrt{}, \vec{}, \bar{}, \overline{},
 * \circ, ^\circ, _{...}, ^{...}, \times, \div, \pm, \leq, \geq, \neq,
 * \mathcal{}, \mathbb{}, \in, \leftarrow, etc.
 * Also matches bare subscript/superscript like X_i or X^2, but NOT snake_case
 * identifiers like `variable_name` — the base letter must not be preceded by
 * another letter, and the subscript char must not be followed by another letter.
 */
const UNDELIMITED_LATEX_RE = /\\(?:text|mbox|hat|frac|sqrt|vec|bar|overline|underline|mathbf|mathrm|mathit|mathcal|mathbb|mathfrak|mathscr|circ|times|div|pm|mp|leq|geq|neq|approx|equiv|sim|in|notin|subset|supset|cup|cap|leftarrow|rightarrow|Leftarrow|Rightarrow|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|omega|phi|psi|infty|partial|nabla|sum|prod|int|lim|log|ln|sin|cos|tan|sec|csc|cot|left|right|cdot|ldots|cdots|quad|qquad|binom|tag)\b|[_^]\{|(?<![A-Za-z])[A-Za-z][_^][A-Za-z0-9](?![A-Za-z])/

function containsMathContent(html: string): boolean {
  if (MATH_INDICATORS.some((indicator) => html.includes(indicator))) return true
  return UNDELIMITED_LATEX_RE.test(html)
}

/**
 * Returns true if the text is mixed prose with embedded math, rather than a
 * pure math expression. We detect this by looking for 3+ consecutive regular
 * English words — pure LaTeX expressions rarely have that.
 */
function isMixedContent(text: string): boolean {
  const words = text.split(/\s+/)
  let consecutive = 0
  for (const word of words) {
    if (/^[a-zA-Z]{3,}[.,;:!?]?$/.test(word)) {
      consecutive++
      if (consecutive >= 3) return true
    } else {
      consecutive = 0
    }
  }
  return false
}

/**
 * For mixed prose+math text nodes, find individual LaTeX expressions and
 * convert them to MathML inline, preserving the surrounding prose text.
 *
 * Matches compound expressions like `\mathcal{Z}_m`, `Z_r`, `f_\theta`,
 * `\{P_i, M_i\}`, etc. Each expression must contain at least one LaTeX
 * marker (backslash command, subscript, or superscript).
 */
function convertInlineLatexFragments(text: string): string {
  // First: handle \{...\} groups (escaped brace groups with content)
  text = text.replace(/\\{(?:[^{}]|\{[^{}]*\})*\\}/g, (expr) => {
    const mathml = tryTemml(expr.trim(), false) ?? tryTemml(expr.trim(), true)
    return mathml ?? expr
  })

  // Match LaTeX expressions: optional leading alphanumeric, one or more "atoms",
  // with optional alphanumeric glue between atoms.
  // Atoms: \command{...}, _\command{...}, _{...}, ^{...}, _x, ^x, \{ or \}
  // The expression must start at a word boundary (not inside an identifier),
  // and bare `_x`/`^x` subscripts cannot be followed by more letters — this
  // prevents snake_case identifiers like `variable_name` from being matched.
  const LATEX_EXPR_RE = /(?<![A-Za-z0-9])[A-Za-z0-9]*(?:(?:\\[a-zA-Z]+(?:\{(?:[^{}]|\{[^{}]*\})*\})*|[_^]\\[a-zA-Z]+(?:\{(?:[^{}]|\{[^{}]*\})*\})*|[_^]\{(?:[^{}]|\{[^{}]*\})*\}|[_^][A-Za-z0-9](?![A-Za-z])|\\[{}])[A-Za-z0-9]*)+/g

  text = text.replace(LATEX_EXPR_RE, (expr) => {
    const trimmed = expr.trim()
    if (!trimmed) return expr
    const mathml = tryTemml(trimmed, false) ?? tryTemml(trimmed, true)
    return mathml ?? expr
  })

  return text
}

// ---------------------------------------------------------------------------
// LaTeX → MathML conversion
// ---------------------------------------------------------------------------

/**
 * Render LaTeX via Temml. Returns null on failure.
 * Temml may embed errors as `<span class="temml-error">` instead of throwing,
 * so we check the output for error spans as well.
 */
function tryTemml(latex: string, displayMode: boolean): string | null {
  try {
    const result = temml.renderToString(latex, { displayMode })
    if (result.includes("temml-error")) return null
    return result
  } catch {
    return null
  }
}

/**
 * Try inline mode first, fall back to display mode if that fails.
 * Handles commands like \tag{} and \\ that require display mode.
 */
function renderLatexWithFallback(latex: string): string | null {
  return tryTemml(latex, false) ?? tryTemml(latex, true)
}

/**
 * Decode HTML entities for $ that htmlparser2 serialization may produce,
 * so that LaTeX delimiters can be matched by the regex patterns below.
 */
function decodeDollarEntities(s: string): string {
  return s.replace(/&#x24;/g, "$").replace(/&#36;/g, "$")
}

/**
 * Decode common HTML entities that Liquid's `escape` filter introduces into
 * LaTeX content (e.g., `>` → `&gt;`, `<` → `&lt;`). Without this, temml
 * receives `\tau&gt;0` instead of `\tau>0` and fails to parse.
 */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/**
 * Convert a plain text string containing LaTeX to MathML.
 * Handles delimited ($, $$, \(, \[) and undelimited LaTeX.
 * Used for text catalog entries (texts.json) that are plain strings.
 *
 * For mixed prose+math (e.g. "the space M = (X, V), where X ∈ ℝ^{N×3}"),
 * only delimited math is converted — the undelimited pass is skipped to
 * avoid rendering the entire paragraph as a math expression.
 */
export function convertLatexString(text: string): string {
  text = decodeDollarEntities(text)

  let converted = convertDelimitedLatex(text)

  // If delimited conversion didn't change anything, try undelimited.
  if (converted === text && UNDELIMITED_LATEX_RE.test(text)) {
    // Pure math expression — render as a single block
    if (!isMixedContent(text)) {
      return renderLatexWithFallback(text.trim()) ?? converted
    }
    // Mixed prose+math — convert individual LaTeX fragments inline
    return convertInlineLatexFragments(converted)
  }

  return converted
}

/**
 * Replace delimited LaTeX math ($$, $, \[, \() with MathML.
 */
function convertDelimitedLatex(text: string): string {
  // Process display math first ($$...$$ and \[...\]) then inline ($...$ and \(...\))
  // to avoid $$...$$ being matched as two inline $...$ blocks.
  // Decode HTML entities (e.g., &gt; → >) inside captured LaTeX before rendering,
  // since Liquid's escape filter encodes <, >, & in text content.

  // $$...$$ — display math
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_match, latex: string) =>
    tryTemml(decodeHtmlEntities(latex.trim()), true) ?? _match
  )

  // \[...\] — display math
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_match, latex: string) =>
    tryTemml(decodeHtmlEntities(latex.trim()), true) ?? _match
  )

  // $...$ — inline math (avoid matching escaped \$ or empty $$)
  // Negative lookbehind for backslash; content must be non-empty and not start/end with space
  text = text.replace(/(?<!\\)\$([^\s$](?:[^$]*[^\s$])?)\$/g, (_match, latex: string) =>
    tryTemml(decodeHtmlEntities(latex.trim()), false) ?? _match
  )

  // \(...\) — inline math
  text = text.replace(/\\\(([\s\S]+?)\\\)/g, (_match, latex: string) =>
    tryTemml(decodeHtmlEntities(latex.trim()), false) ?? _match
  )

  return text
}

/**
 * Replace LaTeX math in HTML content with MathML rendered by Temml.
 * Handles delimited math ($, $$, \(, \[) and undelimited LaTeX in text nodes.
 */
export function convertLatexToMathml(html: string): string {
  html = decodeDollarEntities(html)

  // First pass: convert delimited math anywhere in the string
  html = convertDelimitedLatex(html)

  // Second pass: convert undelimited LaTeX in text nodes (content between > and <).
  // For pure math nodes, render the entire text as a single expression.
  // For mixed prose+math, find and convert individual LaTeX fragments inline.
  html = html.replace(/(>)([^<]+)(<)/g, (_match, open: string, text: string, close: string) => {
    if (!UNDELIMITED_LATEX_RE.test(text)) return _match
    if (text.includes("<math")) return _match
    const decoded = decodeHtmlEntities(text)
    if (isMixedContent(decoded)) {
      const converted = convertInlineLatexFragments(decoded)
      return converted !== decoded ? `${open}${converted}${close}` : _match
    }
    const mathml = renderLatexWithFallback(decoded.trim())
    return mathml ? `${open}${mathml}${close}` : _match
  })

  return html
}

// ---------------------------------------------------------------------------
// Tailwind CSS build
// ---------------------------------------------------------------------------

async function buildTailwindCss(
  adtDir: string,
  webAssetsDir: string,
): Promise<void> {
  const outputPath = path.join(adtDir, "content", "tailwind_output.css")

  // In Tauri sidecar mode, postcss/tailwindcss cannot run inside the pkg binary.
  // bundle.mjs pre-builds tailwind_output.css into webAssetsDir before zipping.
  const preBuilt = path.join(webAssetsDir, "tailwind_output.css")
  if (fs.existsSync(preBuilt)) {
    fs.copyFileSync(preBuilt, outputPath)
    return
  }

  // Dynamic imports to avoid issues if not installed
  const postcss = (await import("postcss")).default
  const tailwindcss = (await import("tailwindcss")).default

  const inputCssPath = path.join(webAssetsDir, "tailwind_css.css")
  const inputCss = fs.existsSync(inputCssPath)
    ? fs.readFileSync(inputCssPath, "utf-8")
    : "@tailwind base;\n@tailwind components;\n@tailwind utilities;"

  const tailwindConfig = {
    content: [
      path.join(adtDir, "**/*.html"),
      path.join(adtDir, "**/*.js"),
    ],
    theme: {
      extend: {
        keyframes: {
          tutorialPopIn: {
            "0%": { opacity: "0", transform: "scale(0.9)" },
            "100%": { opacity: "1", transform: "scale(1)" },
          },
          pulseBorder: {
            "0%": { boxShadow: "0 0 0 0 rgba(49,130,206,0.7)" },
            "70%": { boxShadow: "0 0 0 10px rgba(49,130,206,0)" },
            "100%": { boxShadow: "0 0 0 0 rgba(49,130,206,0)" },
          },
        },
        animation: {
          tutorialPopIn: "tutorialPopIn 0.3s ease-out forwards",
          pulseBorder: "pulseBorder 2s infinite",
        },
        boxShadow: {
          tutorial: "0 0 0 4px rgba(49,130,206,0.3)",
        },
      },
    },
    plugins: [],
  }

  const result = await postcss([tailwindcss(tailwindConfig)]).process(inputCss, {
    from: undefined,
  })

  fs.writeFileSync(outputPath, result.css)
}

/**
 * Build Tailwind CSS for preview and return the CSS string.
 * Scans the given content HTML plus all web asset files for used classes.
 */
export async function buildPreviewTailwindCss(
  contentHtml: string,
  webAssetsDir: string,
): Promise<string> {
  const postcss = (await import("postcss")).default
  const tailwindcss = (await import("tailwindcss")).default

  const inputCssPath = path.join(webAssetsDir, "tailwind_css.css")
  const inputCss = fs.existsSync(inputCssPath)
    ? fs.readFileSync(inputCssPath, "utf-8")
    : "@tailwind base;\n@tailwind components;\n@tailwind utilities;"

  // Also scan the ADT bundle assets for Tailwind classes used by the interface
  const contentSources: Array<{ raw: string; extension: string }> = [
    { raw: contentHtml, extension: "html" },
  ]
  for (const file of ["interface.html", "base.bundle.min.js"]) {
    const filePath = path.join(webAssetsDir, file)
    if (fs.existsSync(filePath)) {
      contentSources.push({
        raw: fs.readFileSync(filePath, "utf-8"),
        extension: path.extname(file).slice(1),
      })
    }
  }

  const tailwindConfig = {
    content: contentSources,
    theme: {
      extend: {
        keyframes: {
          tutorialPopIn: {
            "0%": { opacity: "0", transform: "scale(0.9)" },
            "100%": { opacity: "1", transform: "scale(1)" },
          },
          pulseBorder: {
            "0%": { boxShadow: "0 0 0 0 rgba(49,130,206,0.7)" },
            "70%": { boxShadow: "0 0 0 10px rgba(49,130,206,0)" },
            "100%": { boxShadow: "0 0 0 0 rgba(49,130,206,0)" },
          },
        },
        animation: {
          tutorialPopIn: "tutorialPopIn 0.3s ease-out forwards",
          pulseBorder: "pulseBorder 2s infinite",
        },
        boxShadow: {
          tutorial: "0 0 0 4px rgba(49,130,206,0.3)",
        },
      },
    },
    plugins: [],
  }

  const result = await postcss([tailwindcss(tailwindConfig)]).process(inputCss, {
    from: undefined,
  })

  return result.css
}

// ---------------------------------------------------------------------------
// JS bundle build (base.js → base.bundle.min.js via esbuild)
// ---------------------------------------------------------------------------

async function buildJsBundle(
  webAssetsDir: string,
  outputAssetsDir: string,
): Promise<void> {
  // In Tauri sidecar mode, esbuild cannot run inside the pkg binary.
  // bundle.mjs pre-builds base.bundle.min.js + base.bundle.local.js into
  // webAssetsDir before zipping.  Copy whichever pre-built files exist,
  // then fall through to esbuild for any that are missing (common in dev mode
  // where bundle.mjs hasn't been run).
  const preBuiltEsm = path.join(webAssetsDir, "base.bundle.min.js")
  const preBuiltIife = path.join(webAssetsDir, "base.bundle.local.js")
  const sourceMtime = maxJsSourceMtime(webAssetsDir)

  const hasPreBuiltEsm = isFreshPrebuiltBundle(preBuiltEsm, sourceMtime)
  const hasPreBuiltIife = isFreshPrebuiltBundle(preBuiltIife, sourceMtime)

  if (hasPreBuiltEsm) {
    fs.copyFileSync(preBuiltEsm, path.join(outputAssetsDir, "base.bundle.min.js"))
  }
  if (hasPreBuiltIife) {
    fs.copyFileSync(preBuiltIife, path.join(outputAssetsDir, "base.bundle.local.js"))
  }

  // Both pre-built — nothing left to do
  if (hasPreBuiltEsm && hasPreBuiltIife) return

  // Build any missing bundles with esbuild
  const esbuild = await import("esbuild")
  const entryPoint = path.join(webAssetsDir, "base.js")
  if (!fs.existsSync(entryPoint)) return // skip if no source

  if (!hasPreBuiltEsm) {
    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      minify: true,
      sourcemap: true,
      format: "esm",
      target: "es2020",
      outfile: path.join(outputAssetsDir, "base.bundle.min.js"),
    })
  }

  if (!hasPreBuiltIife) {
    // IIFE version for file:// offline use (no ES module export)
    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      minify: true,
      format: "iife",
      target: "es2020",
      outfile: path.join(outputAssetsDir, "base.bundle.local.js"),
    })
  }
}

function isFreshPrebuiltBundle(bundlePath: string, sourceMtime: number): boolean {
  if (!fs.existsSync(bundlePath)) return false
  return fs.statSync(bundlePath).mtimeMs >= sourceMtime
}

function maxJsSourceMtime(webAssetsDir: string): number {
  let max = 0
  const visit = (filePath: string) => {
    if (!fs.existsSync(filePath)) return
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(filePath)) visit(path.join(filePath, entry))
      return
    }
    if (filePath.endsWith(".js")) max = Math.max(max, stat.mtimeMs)
  }
  visit(path.join(webAssetsDir, "base.js"))
  visit(path.join(webAssetsDir, "modules"))
  return max
}

// ---------------------------------------------------------------------------
// AGENTS.md template rendering
// ---------------------------------------------------------------------------

interface AgentsMdContext {
  title: string
  label: string
  summary: string | undefined
  language: string
  outputLanguages: string[]
  pageList: PageEntry[]
  catalog: TextCatalogOutput | undefined
  glossary: GlossaryOutput | undefined
  quizData: QuizGenerationOutput | undefined
  imageMap: Map<string, string>
  configJson: unknown
  hasGlossary: boolean
  hasQuiz: boolean
}

async function renderAgentsMd(
  templatePath: string,
  ctx: AgentsMdContext,
): Promise<string> {
  const { Liquid } = await import("liquidjs")
  const liquid = new Liquid({ strictVariables: false })
  const template = fs.readFileSync(templatePath, "utf-8")

  const entries = ctx.catalog?.entries ?? []

  // Find sample entries for examples
  const sampleBodyText = entries.find((e) => /_gp\d+_tx\d+$/.test(e.id)) ?? { id: "pg001_gp001_tx001", text: "" }
  const sampleImageText = entries.find((e) => /_im\d+$/.test(e.id)) ?? { id: "pg001_im001", text: "" }

  // Derive the page ID from the first content page's section_id (e.g. "pg002_sec001" → "pg002_sec001")
  const samplePageId = ctx.pageList.find((p) => p.section_id.startsWith("pg") && p.page_number !== undefined)?.section_id
    ?? ctx.pageList[0]?.section_id ?? "pg001_sec001"

  // Glossary sample
  let sampleGlossary: Record<string, unknown> | undefined
  if (ctx.glossary?.items?.length) {
    const item = ctx.glossary.items[0]
    const glId = getGlossaryItemTextId(item, 0)
    sampleGlossary = {
      id: glId,
      defId: `${glId}_def`,
      word: item.word,
      definition: item.definition,
      variations: item.variations,
      variationsJson: JSON.stringify(item.variations),
      emoji: item.emojis.join(""),
    }
  }

  // Quiz sample
  let sampleQuiz: Record<string, unknown> | undefined
  if (ctx.quizData?.quizzes?.length) {
    const quiz = ctx.quizData.quizzes[0]
    const quizId = "qz001"
    const correctAnswers: Record<string, boolean> = {}
    const explanations: Record<string, string> = {}
    const firstQuestion = getQuizQuestions(quiz)[0]
    const options = (firstQuestion.options ?? []).map((opt, i) => {
      const optId = `${quizId}_o${i}`
      const expId = `${optId}_exp`
      correctAnswers[optId] = i === firstQuestion.answerIndex
      explanations[optId] = expId
      return {
        id: optId,
        text: opt.text,
        expId,
        expText: opt.explanation,
      }
    })
    sampleQuiz = {
      id: quizId,
      question: firstQuestion.question,
      options,
      correctAnswersJson: JSON.stringify(correctAnswers),
      explanationsJson: JSON.stringify(explanations),
    }
  }

  // Page images — collect all pg{NNN}_page.* filenames
  const pageImages: string[] = []
  for (const [id, filename] of ctx.imageMap) {
    if (id.endsWith("_page")) {
      pageImages.push(filename)
    }
  }
  pageImages.sort()

  return liquid.parseAndRender(template, {
    title: ctx.title,
    label: ctx.label,
    summary: ctx.summary,
    language: ctx.language,
    outputLanguages: ctx.outputLanguages,
    totalPages: ctx.pageList.length,
    firstPages: ctx.pageList.slice(0, 5),
    samplePageId,
    sampleBodyText,
    sampleImageText,
    sampleGlossary,
    sampleQuiz,
    hasGlossary: ctx.hasGlossary,
    hasQuiz: ctx.hasQuiz,
    configJsonFormatted: JSON.stringify(ctx.configJson, null, 2),
    pageImages,
  })
}

// ---------------------------------------------------------------------------
// SCORM + Offline support generators
// ---------------------------------------------------------------------------

/**
 * Generate `assets/offline-preloader.js` — inlines all JSON/HTML files that
 * the ADT bundle fetches at startup and monkey-patches `window.fetch` to
 * serve them from memory. This allows the ADT to work when opened via
 * `file://` (double-click). On HTTP/HTTPS the patch falls through to real
 * `fetch()`, so it's transparent.
 */
function generateOfflinePreloader(
  adtDir: string,
  outputLanguages: string[],
): void {
  const inline: Record<string, unknown> = {}

  const readTextSafe = (rel: string): string | null => {
    const p = path.join(adtDir, rel)
    return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : null
  }
  const readJsonSafe = (rel: string): unknown | null => {
    const text = readTextSafe(rel)
    if (text === null) return null
    try { return JSON.parse(text) } catch { return null }
  }

  // Shared files
  const interfaceHtml = readTextSafe("assets/interface.html")
  if (interfaceHtml !== null) inline["./assets/interface.html"] = interfaceHtml

  for (const rel of [
    "assets/config.json",
    "content/pages.json",
    "content/toc.json",
  ]) {
    const data = readJsonSafe(rel)
    if (data !== null) inline[`./${rel}`] = data
  }

  const navHtml = readTextSafe("content/navigation/nav.html")
  if (navHtml !== null) inline["./content/navigation/nav.html"] = navHtml

  // Per-language files
  for (const lang of outputLanguages) {
    const itPath = `assets/interface_translations/${lang}/interface_translations.json`
    const itData = readJsonSafe(itPath)
    if (itData !== null) inline[`./${itPath}`] = itData

    for (const file of [
      "texts.json",
      "audios.json",
      "videos.json",
      "glossary.json",
      "timecode/timecode_output.json",
    ]) {
      const rel = `content/i18n/${lang}/${file}`
      const data = readJsonSafe(rel)
      if (data !== null) inline[`./${rel}`] = data
    }
  }

  const js = `// offline-preloader.js — auto-generated, do not edit by hand
(function () {
  var INLINE = ${JSON.stringify(inline)};
  var _realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    var clean = String(url).split("?")[0];
    if (Object.prototype.hasOwnProperty.call(INLINE, clean)) {
      var data = INLINE[clean];
      var isJson = clean.slice(-5) === ".json";
      var body = isJson ? JSON.stringify(data) : data;
      var ct = isJson ? "application/json" : "text/html; charset=utf-8";
      return Promise.resolve(
        new Response(body, { status: 200, headers: { "Content-Type": ct } })
      );
    }
    return _realFetch(url, opts);
  };
  if (location.protocol === 'file:') {
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === 1 && node.tagName === 'LINK' && node.rel === 'manifest') {
            node.parentNode.removeChild(node);
          }
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
`
  fs.writeFileSync(path.join(adtDir, "assets", "offline-preloader.js"), js)
}

/**
 * Generate `assets/scorm.js` — a SCORM 1.2 adapter that tracks learner
 * progress across all activity types. Exits silently when no LMS is present.
 *
 * @param activityIds - All activity IDs in the ADT (quiz IDs + inline activity IDs).
 *   When empty, the ADT is content-only and is marked `passed` on first visit.
 */
function generateScormAdapter(
  assetsDir: string,
  activityIds: string[],
): void {
  const js = `// scorm.js — SCORM 1.2 adapter, auto-generated, do not edit by hand
(function () {
  'use strict';

  // --- Find the SCORM 1.2 API by traversing parent frames ---
  function findAPI(win) {
    var depth = 0;
    while (depth < 7) {
      if (win.API) return win.API;
      if (!win.parent || win.parent === win) break;
      win = win.parent;
      depth++;
    }
    return null;
  }

  var API = findAPI(window);
  if (!API) return; // Not in a SCORM LMS — exit silently

  // --- Initialize the session ---
  API.LMSInitialize('');

  // --- Identify the current page ---
  var metaTitleId = document.querySelector('meta[name="title-id"]');
  var pageId = metaTitleId ? metaTitleId.getAttribute('content') : '';

  // All activity IDs in this ADT (embedded at generation time)
  var ALL_ACTIVITY_IDS = ${JSON.stringify(activityIds)};
  var hasActivities = ALL_ACTIVITY_IDS.length > 0;

  // --- Record where the learner is ---
  API.LMSSetValue('cmi.core.lesson_location', pageId);

  // --- Set lesson status ---
  if (hasActivities) {
    applyStatus();
    watchForCompletions();
  } else {
    // Content-only ADT — mark as passed on first visit
    var existingStatus = API.LMSGetValue('cmi.core.lesson_status') || '';
    if (existingStatus !== 'passed') {
      API.LMSSetValue('cmi.core.lesson_status', 'passed');
      API.LMSSetValue('cmi.core.score.raw', '100');
      API.LMSSetValue('cmi.core.score.min', '0');
      API.LMSSetValue('cmi.core.score.max', '100');
    }
  }

  API.LMSCommit('');

  // --- Session close ---
  window.addEventListener('beforeunload', function () {
    if (hasActivities) applyStatus();
    API.LMSCommit('');
    API.LMSFinish('');
  });

  // -------------------------------------------------------
  // Helpers
  // -------------------------------------------------------

  function getCompletedIds() {
    var completed = [];
    try {
      completed = JSON.parse(localStorage.getItem('completedActivities') || '[]');
    } catch (e) { /* ignore */ }

    var ids = {};
    for (var i = 0; i < completed.length; i++) {
      if (typeof completed[i] === 'string') {
        var dashIdx = completed[i].indexOf('-');
        var actId = dashIdx > -1 ? completed[i].substring(0, dashIdx) : completed[i];
        ids[actId] = true;
      }
    }
    return ids;
  }

  function applyStatus() {
    var completedIds = getCompletedIds();
    var completedCount = 0;
    for (var i = 0; i < ALL_ACTIVITY_IDS.length; i++) {
      if (completedIds[ALL_ACTIVITY_IDS[i]]) completedCount++;
    }

    var score = Math.round((completedCount / ALL_ACTIVITY_IDS.length) * 100);
    API.LMSSetValue('cmi.core.score.raw', String(score));
    API.LMSSetValue('cmi.core.score.min', '0');
    API.LMSSetValue('cmi.core.score.max', '100');

    if (completedCount === ALL_ACTIVITY_IDS.length) {
      API.LMSSetValue('cmi.core.lesson_status', 'passed');
    } else {
      var existingStatus = API.LMSGetValue('cmi.core.lesson_status') || '';
      if (existingStatus !== 'passed') {
        API.LMSSetValue('cmi.core.lesson_status', 'incomplete');
      }
    }
  }

  function watchForCompletions() {
    var _origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
      _origSetItem(key, value);
      if (key === 'completedActivities') {
        applyStatus();
        API.LMSCommit('');
      }
    };

    window.addEventListener('storage', function (e) {
      if (e.key === 'completedActivities') {
        applyStatus();
        API.LMSCommit('');
      }
    });
  }
})();
`
  fs.writeFileSync(path.join(assetsDir, "scorm.js"), js)
}

/**
 * Generate `imsmanifest.xml` at the ADT root for SCORM 1.2 LMS upload.
 * Lists all HTML pages as file entries within a single SCO.
 */
function generateImsManifest(
  adtDir: string,
  title: string,
  label: string,
  pageList: PageEntry[],
): void {
  const identifier = `ADT_${label.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`
  const escapedTitle = escapeHtml(title)

  const fileEntries = pageList
    .filter((p) => p.href !== "index.html") // index.html already listed above
    .map((p) => `      <file href="${escapeAttr(p.href)}"/>`)
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${escapeAttr(identifier)}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                       http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>

  <organizations default="ADT_ORG">
    <organization identifier="ADT_ORG">
      <title>${escapedTitle}</title>
      <item identifier="ITEM_1" identifierref="RESOURCE_1">
        <title>${escapedTitle}</title>
      </item>
    </organization>
  </organizations>

  <resources>
    <resource identifier="RESOURCE_1"
              type="webcontent"
              adlcp:scormtype="sco"
              href="index.html">
      <file href="index.html"/>
${fileEntries}
    </resource>
  </resources>

</manifest>
`
  fs.writeFileSync(path.join(adtDir, "imsmanifest.xml"), xml)
}

/**
 * Scan all HTML files in the ADT directory for `data-area-id` attributes
 * and return the unique set of activity IDs.
 * Also includes quiz section IDs from the page list (entries starting with "qz").
 */
function collectActivityIds(adtDir: string, pageList: PageEntry[]): string[] {
  const ids = new Set<string>()

  // Quiz IDs from page list
  for (const page of pageList) {
    if (page.section_id.startsWith("qz")) {
      ids.add(page.section_id)
    }
  }

  // Scan HTML files for data-area-id (used by activity sections)
  for (const entry of fs.readdirSync(adtDir)) {
    if (!entry.endsWith(".html")) continue
    const html = fs.readFileSync(path.join(adtDir, entry), "utf-8")
    const matches = html.matchAll(/data-area-id="([^"]+)"/g)
    for (const match of matches) {
      ids.add(match[1])
    }
  }

  return Array.from(ids).sort()
}

// ---------------------------------------------------------------------------
// File utilities
// ---------------------------------------------------------------------------

/**
 * Find the first heading-role leaf anywhere in a section's tree.
 * Returns the nodeId and text of the first heading leaf found, or null.
 */
function findHeadingText(
  section: import("@adt/types").PageSectioningSection,
): { textId: string; text: string } | null {
  const walk = (node: ContentNodeData): { textId: string; text: string } | null => {
    if (node.isPruned) return null
    if (node.role === "heading" && node.text) {
      return { textId: node.nodeId, text: node.text }
    }
    if (node.children) {
      for (const c of node.children) {
        const hit = walk(c)
        if (hit) return hit
      }
    }
    return null
  }
  for (const n of section.nodes) {
    const hit = walk(n)
    if (hit) return hit
  }
  return null
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

function pickDefaultLanguage(
  preferredLanguage: string,
  availableLanguages: string[],
): string {
  if (availableLanguages.includes(preferredLanguage)) {
    return preferredLanguage
  }
  const preferredBase = getBaseLanguage(preferredLanguage)
  const matchingBase = availableLanguages.find(
    (lang) => getBaseLanguage(lang) === preferredBase,
  )
  return matchingBase ?? availableLanguages[0] ?? preferredLanguage
}

function escapeInlineScriptJson(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
}

function copyDirRecursive(
  src: string,
  dest: string,
  skip?: Set<string>,
): void {
  fs.mkdirSync(dest, { recursive: true })

  for (const entry of fs.readdirSync(src)) {
    if (skip?.has(entry)) continue
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)
    const stat = fs.statSync(srcPath)
    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// ---------------------------------------------------------------------------
// Static HTML: Navigation component
// ---------------------------------------------------------------------------

export const NAV_HTML = `<nav aria-label="Content Index Menu" aria-labelledby="navPopupTitle" aria-hidden="true" inert class="fixed w-64 sm:w-80 bg-white shadow-lg p-5 border-r border-gray-300 -translate-x-full z-20 hidden rounded-lg top-2 left-0 bottom-2 h-[calc(100vh-5rem)] flex flex-col" id="navPopup" role="navigation">
    <div class="nav__toggle flex flex-col gap-4 mb-4">
        <div class="flex justify-between items-center">
            <h3 class="text-xl font-semibold" data-id="toc-title" id="navPopupTitle">Contents</h3>
            <button aria-label="Close navigation" class="nav__toggle text-gray-700 text-xl p-2" id="nav-close" type="button"><i class="fas fa-close"></i></button>
        </div>
        <div aria-label="Navigation tabs" class="flex rounded-md bg-gray-100 p-1" role="tablist">
            <button aria-controls="nav-panel-toc" aria-selected="true" class="flex-1 rounded-md px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" data-nav-tab="toc" id="nav-tab-toc" role="tab" type="button">
                <span data-id="toc-title">Table of Contents</span>
            </button>
            <button aria-controls="nav-panel-pages" aria-selected="false" class="flex-1 rounded-md px-3 py-2 text-sm font-semibold text-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" data-nav-tab="pages" id="nav-tab-pages" role="tab" type="button">
                <span data-id="nav-page-tab-label">Page List</span>
            </button>
        </div>
        <a class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-4 focus:bg-white focus:border-2 focus:border-blue-600 focus:rounded" href="#content">Table of Contents</a>
    </div>
    <div class="nav__panels flex-1 min-h-0 overflow-hidden">
        <div aria-labelledby="nav-tab-toc" class="h-full" data-nav-panel="toc" id="nav-panel-toc" role="tabpanel">
            <ol class="nav__list overflow-y-auto h-full text-base pr-2" data-id="nav-toc-list" data-nav-type="toc" id="nav-toc-list"></ol>
        </div>
        <div aria-labelledby="nav-tab-pages" class="h-full hidden" data-nav-panel="pages" id="nav-panel-pages" role="tabpanel">
            <ol class="nav__list overflow-y-auto h-full text-base pr-2" data-id="nav-page-list" data-nav-type="pages" id="nav-page-list"></ol>
        </div>
    </div>
</nav>
`
