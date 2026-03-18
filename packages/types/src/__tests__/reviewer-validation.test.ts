import { describe, expect, it } from "vitest"
import {
  ReviewerPageValidationRecord,
  ReviewerPageValidationSections,
  ReviewerValidationIdentificationFields,
  ReviewerValidationInstructions,
  ReviewerValidationSession,
} from "../reviewer-validation.js"

describe("reviewer validation catalog", () => {
  it("includes the extracted page validation sections and criteria", () => {
    expect(ReviewerPageValidationSections).toHaveLength(10)
    expect(ReviewerPageValidationSections[0]?.label).toBe("Text extracted accuracy")

    const criteriaCount = ReviewerPageValidationSections.reduce(
      (total, section) => total + section.criteria.length,
      0,
    )

    expect(criteriaCount).toBe(39)
  })

  it("includes reviewer identification fields and workflow instructions", () => {
    expect(ReviewerValidationIdentificationFields.map((field) => field.id)).toEqual([
      "reviewer-name",
      "institution",
      "start-page",
      "end-page",
      "start-date",
      "end-date",
      "comments",
    ])

    expect(ReviewerValidationInstructions.map((instruction) => instruction.id)).toEqual([
      "objective",
      "workflow",
    ])
  })

  it("supports future per-reviewer and per-language page records", () => {
    const session = ReviewerValidationSession.parse({
      session_id: "session-1",
      reviewer_name: "Jane Reviewer",
      language: "sw",
      start_page: 1,
      end_page: 10,
    })

    const record = ReviewerPageValidationRecord.parse({
      session_id: session.session_id,
      page_id: "page-1",
      page_number: 1,
      href: "content/pages/page-1.html",
      language: "sw",
      results: [
        {
          criterion_id: "text-matches-original-reading-order",
          status: "needs-changes",
          comment: "The heading order differs from the source PDF.",
        },
      ],
    })

    expect(record.language).toBe("sw")
    expect(record.results[0]?.status).toBe("needs-changes")
  })

  it("rejects invalid reviewer page ranges", () => {
    const result = ReviewerValidationSession.safeParse({
      session_id: "session-1",
      reviewer_name: "Jane Reviewer",
      start_page: 12,
      end_page: 3,
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(["end_page"])
  })
})
