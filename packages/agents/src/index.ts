export { mirrorLayout } from "./layout-mirror.js"
export type {
  LayoutMirrorOptions,
  LayoutMirrorTarget,
  LayoutMirrorTargetResult,
  LayoutMirrorResult,
} from "./layout-mirror.js"

export { generateActivity } from "./generate-activity.js"
export type {
  GenerateActivityOptions,
  GenerateActivityResult,
} from "./generate-activity.js"

export { runAgent } from "./runner.js"
export type { RunAgentOptions, RunAgentResult } from "./runner.js"

export { createBookTools } from "./tools/book-tools.js"
export type {
  BookToolsContext,
  BookToolsResult,
  BookToolCallRecord,
} from "./tools/book-tools.js"

export { resolveAgentModel } from "./resolve-model.js"
export type { AgentCredentials } from "./resolve-model.js"

export { ACTIVITY_GENERATION_SYSTEM_PROMPT } from "./prompts/activity-generation.js"
export {
  LAYOUT_MIRROR_SYSTEM_PROMPT,
  buildLayoutMirrorUserPrompt,
} from "./prompts/layout-mirror.js"
