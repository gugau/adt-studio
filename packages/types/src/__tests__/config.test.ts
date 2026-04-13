import { describe, expect, it } from "vitest"
import { AppConfig, RenderStrategyConfig } from "../config.js"
import { TranslationEvaluationResult } from "../translation-evaluation.js"

describe("RenderStrategyConfig", () => {
  it("allows answer_prompt for activity render types", () => {
    const result = RenderStrategyConfig.safeParse({
      render_type: "activity",
      config: {
        prompt: "activity_multiple_choice",
        answer_prompt: "activity_multiple_choice_answers",
      },
    })
    expect(result.success).toBe(true)
  })

  it("rejects answer_prompt for non-activity render types", () => {
    const result = RenderStrategyConfig.safeParse({
      render_type: "llm",
      config: {
        prompt: "web_generation_html",
        answer_prompt: "activity_multiple_choice_answers",
      },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["config", "answer_prompt"])
      expect(result.error.issues[0]?.message).toContain("only supported for render_type: activity")
    }
  })
})

describe("AppConfig", () => {
  it("fails when a non-activity render strategy includes answer_prompt", () => {
    const result = AppConfig.safeParse({
      text_types: { heading: "Heading" },
      text_group_types: { paragraph: "Paragraph" },
      render_strategies: {
        bad_strategy: {
          render_type: "template",
          config: {
            template: "two_column_render",
            answer_prompt: "activity_multiple_choice_answers",
          },
        },
      },
    })
    expect(result.success).toBe(false)
  })


  it("accepts reviewer_validation catalog overrides", () => {
    const result = AppConfig.safeParse({
      text_types: { heading: "Heading" },
      text_group_types: { paragraph: "Paragraph" },
      reviewer_validation: {
        enabled: true,
        identification_fields: [
          {
            id: "reviewer-name",
            label: "Reviewer name",
            type: "text",
            required: true,
          },
        ],
        instructions: [
          {
            id: "workflow",
            title: "Workflow",
            body: "Review pages in order.",
          },
        ],
        sections: [
          {
            id: "custom-checks",
            label: "Custom checks",
            criteria: [
              {
                id: "custom-criterion",
                label: "Custom criterion",
                guidance: "Check this custom requirement.",
              },
            ],
          },
        ],
      },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reviewer_validation?.enabled).toBe(true)
      expect(result.data.reviewer_validation?.sections?.[0]?.id).toBe("custom-checks")
    }
  })

  it("accepts translation_evaluation config", () => {
    const result = AppConfig.safeParse({
      text_types: { heading: "Heading" },
      text_group_types: { paragraph: "Paragraph" },
      translation_evaluation: {
        enable_translation_evaluation: true,
        judge_model: "openai:/gpt-4.1-mini",
        max_retries: 3,
        evaluation_scope_mode: "sample",
        evaluation_scope_count: 100,
        sampling_method: "random",
        sampling_seed: 1234,
        batch_size: 10,
        judge_instructions: "Review {{ inputs }} against {{ outputs }}.",
        additional_guidance: "Prefer classroom-friendly terminology.",
      },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.translation_evaluation?.enable_translation_evaluation).toBe(true)
      expect(result.data.translation_evaluation?.evaluation_scope_count).toBe(100)
      expect(result.data.translation_evaluation?.batch_size).toBe(10)
    }
  })
})

describe("TranslationEvaluationResult", () => {
  it("accepts acceptable and unacceptable counts that match total", () => {
    const result = TranslationEvaluationResult.safeParse({
      generated_at: "2026-04-06T12:00:00.000Z",
      provider: "mlflow",
      language: "fr",
      source_catalog_version: 4,
      translation_version: 3,
      eval_config_hash: "cfg-123",
      summary: {
        total: 2,
        acceptable: 1,
        unacceptable: 1,
      },
      items: [
        {
          entry_id: "pg001:body",
          acceptable: true,
          rationale: "The translation preserves the meaning.",
        },
        {
          entry_id: "pg002:body",
          acceptable: false,
          rationale: "The translation omits a key instruction.",
          issue_types: ["omission-or-addition"],
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it("rejects summaries whose totals do not match", () => {
    const result = TranslationEvaluationResult.safeParse({
      generated_at: "2026-04-06T12:00:00.000Z",
      provider: "mlflow",
      language: "fr",
      source_catalog_version: 4,
      translation_version: 3,
      eval_config_hash: "cfg-123",
      summary: {
        total: 2,
        acceptable: 2,
        unacceptable: 1,
      },
      items: [],
    })

    expect(result.success).toBe(false)
  })
})
