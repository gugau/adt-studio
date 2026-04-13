#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import { createLLMModel, createPromptEngine, createRateLimiter } from "@adt/llm"
import { createBookStorage } from "@adt/storage"
import type { ImageClassificationOutput, AppConfig, TypeDef } from "@adt/types"
import { structurePage, buildStructureConfig } from "./page-structuring.js"
import type { PageInput, StructureConfig } from "./page-structuring.js"
import { judgePage, aggregateScores, type PageEvaluation, type AggregatedScores } from "./eval-judge.js"
import { proposeImprovements, applyImprovements, type ImprovementPlan } from "./eval-improver.js"
import { generateReport, type ReportData, type ReportIteration, type ReportIterationPageResult } from "./eval-report.js"
import { loadBookConfig } from "./config.js"

const USAGE = `Usage: pnpm eval-structuring -- --label <book-id> --books-root <path> [options]

Options:
  --label           Book label (required)
  --books-root      Books root directory (required)
  --iterations      Number of improvement iterations (default: 3)
  --pages           Page range, e.g. "1-5" or "1,3,7" (default: sample up to 8)
  --config          Path to config.yaml (default: ./config.yaml)
  --judge-model     Model for judge/improver (default: openai:gpt-5.4)
  -h, --help        Show this help`

interface EvalArgs {
  label: string
  booksRoot: string
  iterations: number
  pageRange: string | undefined
  configPath: string
  judgeModel: string
}

function parseArgs(args: string[]): EvalArgs {
  let label: string | undefined
  let booksRoot: string | undefined
  let iterations = 3
  let pageRange: string | undefined
  let configPath: string | undefined
  let judgeModel = "openai:gpt-5.4"

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--label") {
      label = args[++i]
    } else if (arg === "--books-root") {
      booksRoot = args[++i]
    } else if (arg === "--iterations") {
      iterations = parseInt(args[++i], 10)
    } else if (arg === "--pages") {
      pageRange = args[++i]
    } else if (arg === "--config") {
      configPath = args[++i]
    } else if (arg === "--judge-model") {
      judgeModel = args[++i]
    } else if (arg === "-h" || arg === "--help") {
      process.stderr.write(USAGE + "\n")
      process.exit(0)
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  if (!label) throw new Error("--label is required")
  if (!booksRoot) throw new Error("--books-root is required")
  if (isNaN(iterations) || iterations < 1) throw new Error("--iterations must be a positive integer")

  // INIT_CWD is set by pnpm to the original working directory.
  // Without it, relative paths resolve from packages/pipeline/ instead of the repo root.
  const resolveBase = process.env.INIT_CWD ?? process.cwd()
  const resolve = (p: string) => path.resolve(resolveBase, p)

  return {
    label,
    booksRoot: resolve(booksRoot),
    iterations,
    pageRange,
    configPath: resolve(configPath ?? "config.yaml"),
    judgeModel,
  }
}

function parsePageRange(range: string, totalPages: number): number[] {
  const pages = new Set<number>()
  for (const part of range.split(",")) {
    const trimmed = part.trim()
    if (trimmed.includes("-")) {
      const [start, end] = trimmed.split("-").map(Number)
      for (let p = start; p <= end && p <= totalPages; p++) {
        if (p >= 1) pages.add(p)
      }
    } else {
      const p = Number(trimmed)
      if (p >= 1 && p <= totalPages) pages.add(p)
    }
  }
  return [...pages].sort((a, b) => a - b)
}

function samplePages(totalPages: number, maxSample: number): number[] {
  if (totalPages <= maxSample) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages = new Set<number>()
  pages.add(1)
  pages.add(totalPages)
  const remaining = maxSample - 2
  for (let i = 1; i <= remaining; i++) {
    const p = Math.round((i * (totalPages - 1)) / (remaining + 1)) + 1
    pages.add(p)
  }
  return [...pages].sort((a, b) => a - b)
}

function log(msg: string): void {
  process.stderr.write(msg)
}

function fmt(n: number): string {
  return n.toFixed(1).padStart(5)
}

function printScoresTable(
  evaluations: Array<{ pageId: string; evaluation: PageEvaluation }>,
  aggregated: AggregatedScores
): void {
  log("\nPage Scores:\n")
  log(
    "  Page    | Overall | Text  | Accuracy | Structure | Types | Images | Order\n"
  )
  log(
    "  --------+---------+-------+----------+-----------+-------+--------+------\n"
  )
  for (const { pageId, evaluation } of evaluations) {
    const s = evaluation.scores
    log(
      `  ${pageId.padEnd(8)}|  ${fmt(evaluation.overall_score)} |${fmt(s.text_completeness)} |   ${fmt(s.text_accuracy)}  |    ${fmt(s.tree_structure)}  |${fmt(s.type_accuracy)} |  ${fmt(s.image_placement)} |${fmt(s.reading_order)}\n`
    )
  }
  log(
    "  --------+---------+-------+----------+-----------+-------+--------+------\n"
  )
  log(
    `  Average |  ${fmt(aggregated.overall)} |${fmt(aggregated.text_completeness)} |   ${fmt(aggregated.text_accuracy)}  |    ${fmt(aggregated.tree_structure)}  |${fmt(aggregated.type_accuracy)} |  ${fmt(aggregated.image_placement)} |${fmt(aggregated.reading_order)}\n`
  )
}

function printIssues(
  evaluations: Array<{ pageId: string; evaluation: PageEvaluation }>
): void {
  const allIssues = evaluations.flatMap(({ pageId, evaluation }) =>
    evaluation.issues.map((issue) => ({ pageId, ...issue }))
  )
  const sorted = allIssues.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.severity] - order[b.severity]
  })
  if (sorted.length === 0) {
    log("\nNo issues found.\n")
    return
  }
  log("\nIssues:\n")
  for (const issue of sorted.slice(0, 20)) {
    log(`  [${issue.severity.toUpperCase().padEnd(6)}] ${issue.pageId}: ${issue.description}\n`)
  }
  if (sorted.length > 20) {
    log(`  ... and ${sorted.length - 20} more\n`)
  }
}

function printImprovements(plan: ImprovementPlan): void {
  log("\nProposed Improvements:\n")
  log(`  Reasoning: ${plan.reasoning}\n`)

  if (plan.description_changes.length > 0) {
    log("\n  Description changes:\n")
    for (const change of plan.description_changes) {
      log(`    ~ ${change.category}.${change.key}: "${change.new_description}"\n`)
    }
  }

  if (plan.prompt_changes.should_modify) {
    log(`\n  Prompt: ${plan.prompt_changes.change_summary}\n`)
  } else {
    log("\n  Prompt: No changes\n")
  }
}

function printFinalSummary(
  history: Array<{ iteration: number; trainScores: AggregatedScores; testScores: AggregatedScores }>
): void {
  const printTable = (label: string, getScores: (h: typeof history[0]) => AggregatedScores) => {
    log(`\n  ${label}:\n`)
    log(
      "  Iteration | Overall | Text  | Accuracy | Structure | Types | Images | Order\n"
    )
    log(
      "  ----------+---------+-------+----------+-----------+-------+--------+------\n"
    )
    for (const entry of history) {
      const scores = getScores(entry)
      log(
        `     ${String(entry.iteration).padStart(2)}     |  ${fmt(scores.overall)} |${fmt(scores.text_completeness)} |   ${fmt(scores.text_accuracy)}  |    ${fmt(scores.tree_structure)}  |${fmt(scores.type_accuracy)} |  ${fmt(scores.image_placement)} |${fmt(scores.reading_order)}\n`
      )
    }
    if (history.length >= 2) {
      const first = getScores(history[0]).overall
      const last = getScores(history[history.length - 1]).overall
      const delta = last - first
      const sign = delta >= 0 ? "+" : ""
      log(`  Change: ${sign}${delta.toFixed(1)} (${first.toFixed(1)} -> ${last.toFixed(1)})\n`)
    }
  }

  log("\n=== Final Results ===\n")
  printTable("Train (even pages — used for improvements)", (h) => h.trainScores)
  printTable("Test (odd pages — measures generalization)", (h) => h.testScores)
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const resolveBase = process.env.INIT_CWD ?? process.cwd()
  const promptsDir = path.resolve(resolveBase, "prompts")

  log(`\nEval Structuring: ${args.label}\n`)
  log(`  Books root: ${args.booksRoot}\n`)
  log(`  Iterations: ${args.iterations}\n`)
  log(`  Judge model: ${args.judgeModel}\n`)

  // Load book storage and config
  const storage = createBookStorage(args.label, args.booksRoot)
  const allPages = storage.getPages()
  if (allPages.length === 0) {
    throw new Error(`No pages found for book "${args.label}". Has it been extracted?`)
  }

  let appConfig = loadBookConfig(args.label, args.booksRoot, args.configPath)

  // Determine which pages to evaluate
  const pageNumbers = args.pageRange
    ? parsePageRange(args.pageRange, allPages.length)
    : samplePages(allPages.length, 8)

  const selectedPages = allPages.filter((p) => pageNumbers.includes(p.pageNumber))

  // Train/test split: even page numbers = train (used for improvements), odd = test (measures generalization)
  const trainPageNumbers = new Set(selectedPages.filter((p) => p.pageNumber % 2 === 0).map((p) => p.pageNumber))
  const testPageNumbers = new Set(selectedPages.filter((p) => p.pageNumber % 2 !== 0).map((p) => p.pageNumber))
  const trainLabels = selectedPages.filter((p) => trainPageNumbers.has(p.pageNumber)).map((p) => p.pageId)
  const testLabels = selectedPages.filter((p) => testPageNumbers.has(p.pageNumber)).map((p) => p.pageId)
  log(`  Train pages (even): ${trainLabels.join(", ") || "(none)"} (${trainLabels.length})\n`)
  log(`  Test pages  (odd):  ${testLabels.join(", ") || "(none)"} (${testLabels.length})\n`)

  // Build page inputs once (images don't change between iterations)
  const pageInputs: PageInput[] = selectedPages.map((page) => {
    const imageBase64 = storage.getPageImageBase64(page.pageId)
    const filterRow = storage.getLatestNodeData("image-filtering", page.pageId)
    const imageClassification = filterRow?.data as ImageClassificationOutput | undefined
    const unprunedImageIds = new Set(
      (imageClassification?.images ?? [])
        .filter((img) => !img.isPruned)
        .map((img) => img.imageId)
    )
    const allPageImages = storage.getPageImages(page.pageId)
    const images = allPageImages
      .filter((img) => unprunedImageIds.has(img.imageId))
      .map((img) => ({
        imageId: img.imageId,
        imageBase64: storage.getImageBase64(img.imageId),
      }))
    return {
      pageId: page.pageId,
      pageNumber: page.pageNumber,
      text: page.text,
      imageBase64,
      images,
    }
  })

  // Read the initial prompt template
  const promptName = appConfig.page_structuring?.prompt ?? "page_structuring"
  const originalPromptPath = path.join(promptsDir, `${promptName}.liquid`)
  let currentPromptText = fs.readFileSync(originalPromptPath, "utf-8")

  // Create the judge/improver model (separate from structurer, can use different model)
  const judgeModel = createLLMModel({
    modelId: args.judgeModel,
    logLevel: "error",
  })

  // Report data collection
  const reportData: ReportData = {
    bookLabel: args.label,
    timestamp: new Date().toISOString(),
    judgeModel: args.judgeModel,
    structureModel: appConfig.page_structuring?.model ?? "openai:gpt-5.4",
    pages: pageInputs.map((p) => ({
      pageId: p.pageId,
      pageNumber: p.pageNumber,
      ocrText: p.text,
      imageBase64: p.imageBase64,
    })),
    trainPageNumbers: [...trainPageNumbers],
    testPageNumbers: [...testPageNumbers],
    iterations: [],
  }

  const history: Array<{ iteration: number; trainScores: AggregatedScores; testScores: AggregatedScores }> = []
  let promptOverrideDir: string | null = null

  for (let iteration = 1; iteration <= args.iterations; iteration++) {
    log(`\n${"=".repeat(60)}\n`)
    log(`=== Iteration ${iteration}/${args.iterations} ===\n`)
    log(`${"=".repeat(60)}\n`)

    // Build config and LLM model for this iteration
    const structureConfig = buildStructureConfig(appConfig)

    const reportIteration: ReportIteration = {
      iteration,
      config: {
        textTypes: structureConfig.textTypes,
        containerTypes: structureConfig.containerTypes,
      },
      promptText: currentPromptText,
      pageResults: [],
      aggregatedScores: null,
      trainScores: null,
      improvementPlan: null,
    }

    const promptRoots = promptOverrideDir
      ? [promptOverrideDir, promptsDir]
      : [promptsDir]
    const promptEngine = createPromptEngine(promptRoots)

    const rateLimiter = appConfig.rate_limit
      ? createRateLimiter(appConfig.rate_limit.requests_per_minute)
      : undefined

    const structureModel = createLLMModel({
      modelId: structureConfig.modelId,
      promptEngine,
      rateLimiter,
      logLevel: "error",
    })

    // Run structuring on all sampled pages
    log("\nRunning page-structuring...\n")
    const structureResults = new Map<string, Awaited<ReturnType<typeof structurePage>>>()
    const structureErrors = new Map<string, string>()

    await Promise.all(
      pageInputs.map(async (pageInput) => {
        try {
          const result = await structurePage(pageInput, structureConfig, structureModel)
          structureResults.set(pageInput.pageId, result)
          log(`  ${pageInput.pageId} ✓\n`)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          structureErrors.set(pageInput.pageId, msg)
          log(`  ${pageInput.pageId} ✗ ${msg}\n`)
        }
      })
    )

    if (structureErrors.size > 0) {
      log(`\n  ${structureErrors.size} page(s) failed structuring\n`)
    }

    // Judge each page
    log("\nJudging results...\n")
    const evaluations: Array<{ pageId: string; evaluation: PageEvaluation }> = []
    const typeConfig = {
      textTypes: structureConfig.textTypes,
      containerTypes: structureConfig.containerTypes,
    }

    await Promise.all(
      pageInputs.map(async (pageInput) => {
        const result = structureResults.get(pageInput.pageId)
        if (!result) return
        try {
          const evaluation = await judgePage(pageInput, result, typeConfig, judgeModel)
          evaluations.push({ pageId: pageInput.pageId, evaluation })
          log(`  ${pageInput.pageId} judged: ${evaluation.overall_score}/10\n`)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          log(`  ${pageInput.pageId} judge failed: ${msg}\n`)
        }
      })
    )

    // Build report page results for this iteration
    const evalMap = new Map(evaluations.map((e) => [e.pageId, e.evaluation]))
    for (const pageInput of pageInputs) {
      const pr: ReportIterationPageResult = {
        pageId: pageInput.pageId,
        structuringResult: structureResults.get(pageInput.pageId) ?? null,
        evaluation: evalMap.get(pageInput.pageId) ?? null,
        error: structureErrors.get(pageInput.pageId) ?? null,
      }
      reportIteration.pageResults.push(pr)
    }

    if (evaluations.length === 0) {
      log("\nNo successful evaluations — skipping iteration.\n")
      reportData.iterations.push(reportIteration)
      continue
    }

    // Split evaluations into train (even pages) and test (odd pages)
    const trainEvals = evaluations.filter((e) => {
      const p = pageInputs.find((pi) => pi.pageId === e.pageId)
      return p && trainPageNumbers.has(p.pageNumber)
    })
    const testEvals = evaluations.filter((e) => {
      const p = pageInputs.find((pi) => pi.pageId === e.pageId)
      return p && testPageNumbers.has(p.pageNumber)
    })

    // Print scores for both sets
    const trainAgg = aggregateScores(trainEvals)
    const testAgg = aggregateScores(testEvals)

    if (trainEvals.length > 0) {
      log("\nTrain Scores (even pages — used for improvements):\n")
      printScoresTable(trainEvals, trainAgg)
    }
    if (testEvals.length > 0) {
      log("\nTest Scores (odd pages — measures generalization):\n")
      printScoresTable(testEvals, testAgg)
    }
    printIssues(evaluations)
    history.push({ iteration, trainScores: trainAgg, testScores: testAgg })
    reportIteration.aggregatedScores = testAgg
    reportIteration.trainScores = trainAgg

    // Propose improvements using ONLY train evaluations (even pages)
    if (iteration < args.iterations && trainEvals.length > 0) {
      log("\nProposing improvements (based on train pages only)...\n")
      try {
        const plan = await proposeImprovements(
          trainEvals,
          typeConfig,
          currentPromptText,
          judgeModel
        )
        printImprovements(plan)
        reportIteration.improvementPlan = plan

        const applied = applyImprovements(
          appConfig,
          plan,
          promptsDir,
          promptName
        )

        if (applied.descriptionChangesApplied > 0 || applied.promptChanged) {
          appConfig = applied.config
          if (applied.promptDir) {
            promptOverrideDir = applied.promptDir
            currentPromptText =
              plan.prompt_changes.new_prompt ?? currentPromptText
          }
          log(
            `\n  Applied: ${applied.descriptionChangesApplied} description change(s)${applied.promptChanged ? " + prompt update" : ""}\n`
          )
        } else {
          log("\n  No changes applied.\n")
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        log(`\n  Improvement proposal failed: ${msg}\n`)
      }
    }

    reportData.iterations.push(reportIteration)
  }

  // Final summary
  if (history.length > 0) {
    printFinalSummary(history)
  }

  // Print final config state
  log("\n=== Final Configuration ===\n")
  log("\nText Types:\n")
  for (const [key, desc] of Object.entries(appConfig.text_types ?? {})) {
    log(`  ${key}: ${desc}\n`)
  }
  log("\nImage Types:\n")
  for (const [key, desc] of Object.entries(appConfig.image_types ?? {})) {
    log(`  ${key}: ${desc}\n`)
  }
  log("\nContainer Types:\n")
  for (const [key, desc] of Object.entries(appConfig.container_types ?? {})) {
    log(`  ${key}: ${desc}\n`)
  }

  if (promptOverrideDir) {
    const finalPromptPath = path.join(promptOverrideDir, `${promptName}.liquid`)
    log(`\nModified prompt saved to: ${finalPromptPath}\n`)
  }

  // Generate HTML report
  const reportHtml = generateReport(reportData)
  const reportDir = path.join(args.booksRoot, args.label)
  const reportPath = path.join(reportDir, "eval-report.html")
  fs.writeFileSync(reportPath, reportHtml, "utf-8")
  log(`\nReport saved to: ${reportPath}\n`)

  log("\n")
  storage.close()
}

main().catch((err) => {
  const detail = err instanceof Error ? err.stack ?? err.message : String(err)
  process.stderr.write(`\nFailed: ${detail}\n`)
  process.exit(1)
})
