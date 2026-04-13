import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { z } from "zod"
import type { LLMModel, Message } from "@adt/llm"
import type { TypeDef, AppConfig } from "@adt/types"
import type { PageEvaluation } from "./eval-judge.js"

const IMPROVER_MAX_TOKENS = 16384

const ImprovementPlanSchema = z.object({
  reasoning: z.string(),
  description_changes: z.array(
    z.object({
      category: z.enum(["text_types", "container_types"]),
      key: z.string(),
      new_description: z.string(),
    })
  ),
  prompt_changes: z.object({
    should_modify: z.boolean(),
    new_prompt: z.string().nullable(),
    change_summary: z.string(),
  }),
})

export type ImprovementPlan = z.infer<typeof ImprovementPlanSchema>

const IMPROVER_SYSTEM = `You are an expert at improving LLM prompts and configuration for book page content structuring. You will receive:
1. Evaluation results for multiple pages, including scores, issues, and suggestions
2. The current type definitions (text_types, container_types) with their descriptions
3. The current Liquid prompt template used for page structuring

Your task is to propose targeted improvements that will address the most impactful issues.

## How Config Maps to Node Fields

- Container types define valid values for the \`structure\` field on container nodes (how content is grouped). The "image" container type is used for images, with \`image_id\` set on the container.
- Text types define valid values for the \`role\` field on text leaf nodes (what the text means semantically)

## Guidelines for Type Description Changes

- The set of types is fixed — you cannot add or remove types, only improve their descriptions
- Modify a type's description when the LLM consistently misuses it, suggesting the description is unclear
- Good descriptions are concise and unambiguous — they help the LLM distinguish between similar types

## Guidelines for Prompt Changes

- Only modify the prompt if there are systematic issues that can't be fixed by description changes alone
- Preserve the overall structure of the Liquid template ({% chat %} tags, variable references)
- Focus on clarifying rules, adding examples, or fixing ambiguities
- Do NOT hardcode specific type names in the prompt — types are injected via config variables ({% for %} loops over text_types, container_types). The prompt must work with any set of types.
- The prompt uses Liquid syntax: {% chat role: "system" %}, {% chat role: "user" %}, {% image varname %}, {{ variable }}, {% for %} loops
- Do NOT change the user message section (the part that injects page data) — only modify the system message rules and examples
- If you provide a new_prompt, it must be a COMPLETE replacement for the template file (not a diff)

## Important

- Be surgical — make the minimum changes needed to address the highest-impact issues
- Don't change things that are working well
- Explain your reasoning clearly so a human can review the changes`

export async function proposeImprovements(
  evaluations: Array<{ pageId: string; evaluation: PageEvaluation }>,
  currentConfig: {
    textTypes: TypeDef[]
    containerTypes: TypeDef[]
  },
  currentPrompt: string,
  llmModel: LLMModel
): Promise<ImprovementPlan> {
  const evalSummary = evaluations
    .map(({ pageId, evaluation }) => {
      const issueList = evaluation.issues
        .map((i) => `  [${i.severity.toUpperCase()}] ${i.category}: ${i.description}`)
        .join("\n")
      return `### ${pageId} (score: ${evaluation.overall_score}/10)
Scores: text_completeness=${evaluation.scores.text_completeness}, text_accuracy=${evaluation.scores.text_accuracy}, tree_structure=${evaluation.scores.tree_structure}, type_accuracy=${evaluation.scores.type_accuracy}, image_placement=${evaluation.scores.image_placement}, reading_order=${evaluation.scores.reading_order}
Issues:
${issueList || "  (none)"}
Suggestions: ${evaluation.suggestions}`
    })
    .join("\n\n")

  const typeSummary = `## Current Text Types
${currentConfig.textTypes.map((t) => `- ${t.key}: ${t.description}`).join("\n")}

## Current Container Types
${currentConfig.containerTypes.map((t) => `- ${t.key}: ${t.description}`).join("\n")}`

  const messages: Message[] = [
    {
      role: "user",
      content: `Based on the following evaluation results, propose improvements to the type definitions and/or prompt template.

## Page Evaluations

${evalSummary}

${typeSummary}

## Current Prompt Template

\`\`\`liquid
${currentPrompt}
\`\`\`

Propose targeted improvements to address the most impactful issues found across all pages.`,
    },
  ]

  const result = await llmModel.generateObject<ImprovementPlan>({
    schema: ImprovementPlanSchema,
    system: IMPROVER_SYSTEM,
    messages,
    maxTokens: IMPROVER_MAX_TOKENS,
    log: {
      taskType: "eval-improver",
      promptName: "eval-improver",
    },
  })

  return result.object
}

export interface AppliedImprovements {
  config: AppConfig
  promptDir: string | null
  descriptionChangesApplied: number
  promptChanged: boolean
}

export function applyImprovements(
  currentConfig: AppConfig,
  plan: ImprovementPlan,
  originalPromptsDir: string,
  promptName: string
): AppliedImprovements {
  const config = structuredClone(currentConfig)
  let descriptionChangesApplied = 0

  for (const change of plan.description_changes) {
    const targetMap =
      change.category === "text_types"
        ? config.text_types
        : config.container_types

    if (!targetMap) continue

    if (change.key in targetMap) {
      targetMap[change.key] = change.new_description
      descriptionChangesApplied++
    }
  }

  let promptDir: string | null = null
  let promptChanged = false

  if (plan.prompt_changes.should_modify && plan.prompt_changes.new_prompt) {
    try {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-structuring-"))
      const promptFile = path.join(tmpDir, `${promptName}.liquid`)
      fs.writeFileSync(promptFile, plan.prompt_changes.new_prompt, "utf-8")
      promptDir = tmpDir
      promptChanged = true
    } catch {
      // If writing fails, skip the prompt change
    }
  }

  return { config, promptDir, descriptionChangesApplied, promptChanged }
}
