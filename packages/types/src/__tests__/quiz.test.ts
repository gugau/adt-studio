import { describe, expect, it } from "vitest"
import { getQuizLLMSchema } from "../quiz.js"

describe("quiz LLM schemas", () => {
  it("requires open-ended helper fields for provider-compatible structured output", () => {
    const schema = getQuizLLMSchema("open_ended")

    expect(schema.safeParse({
      activity_type: "open_ended",
      reasoning: "The page asks for a personal response.",
      question: "Why did Karma ask for help?",
      sample_answer: "Karma asked for help because the task was difficult.",
      guidance: "Look for a reason tied to the story.",
    }).success).toBe(true)

    expect(schema.safeParse({
      activity_type: "open_ended",
      reasoning: "The page asks for a personal response.",
      question: "Why did Karma ask for help?",
    }).success).toBe(false)
  })
})
