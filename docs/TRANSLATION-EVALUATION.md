# Translation Evaluation

This document describes the translation evaluation feature in ADT Studio: what it does, how it is configured, and how evaluation requests flow through the TypeScript API.

## Overview

Translation evaluation is an optional validation workflow for translated `text-catalog` content.

It answers one question for each translated entry:

- is this translation acceptable as-is?
- if not, why does it need review?
- if there is a clear correction, what target-language text should replace it?

The implementation uses:

- ADT Studio as the system of record for books, versions, and UI
- the existing TypeScript `apps/api` service for orchestration and judge execution
- the cached/logged `@adt/llm` client for LLM-as-judge calls
- each book's SQLite database for versioned evaluation results

Evaluation runs in the API process and stores results in each book database.

## Deployment Topology

Translation evaluation runs inside the normal ADT Studio stack:

```text
browser
  |
  v
studio (nginx or Vite)
  |
  v
api (Hono)
  |
  +--> @adt/llm cached judge calls
  |
  v
book SQLite database
```

Relevant local volume in `docker-compose.yml`:

- `./books:/app/books`
  - ADT Studio book storage, including each book's SQLite database and LLM cache

Translation evaluation uses the OpenAI API key provided by the user in Studio. The Studio run request sends that key to the API using the existing `X-OpenAI-Key` header pattern.
If no browser key is saved, the API can fall back to `OPENAI_API_KEY` configured on the server.

## Architecture

### 1. Shared schemas and config

File:

- [`packages/types/src/translation-evaluation.ts`](../packages/types/src/translation-evaluation.ts)

This file defines:

- persisted translation-evaluation config
- config defaults and compatibility handling
- evaluation run request schema
- stored result schema

It is the single source of truth for:

- `translation_evaluation` config fields
- normalized evaluation request/result shapes
- stored evaluation result shape in the book database

### 2. API orchestration and judging

Files:

- [`apps/api/src/routes/translation-evaluations.ts`](../apps/api/src/routes/translation-evaluations.ts)
- [`apps/api/src/services/translation-evaluation-runner.ts`](../apps/api/src/services/translation-evaluation-runner.ts)
- [`apps/api/src/services/translation-evaluation-service.ts`](../apps/api/src/services/translation-evaluation-service.ts)

Responsibilities:

- validate route inputs
- require the user-provided `X-OpenAI-Key` header for new runs
- load the latest source and translated text catalog versions
- resolve evaluation settings
- apply evaluation scope and sampling
- submit a background `translation-evaluation` task
- evaluate selected entries with `@adt/llm`
- validate the returned result
- store the result locally as a versioned `translation-evaluation` artifact

### 3. Studio UI

Files:

- [`apps/studio/src/components/validation/TranslationEvaluationTab.tsx`](../apps/studio/src/components/validation/TranslationEvaluationTab.tsx)
- [`apps/studio/src/components/validation/TranslationEvaluationSettingsTab.tsx`](../apps/studio/src/components/validation/TranslationEvaluationSettingsTab.tsx)
- [`apps/studio/src/hooks/use-translation-evaluation.ts`](../apps/studio/src/hooks/use-translation-evaluation.ts)

Responsibilities:

- run evaluations
- pass the user-provided OpenAI API key to the API
- show task progress
- show stored results by language
- sort entries that need review before acceptable entries
- show suggested fixes and let users accept a fix into the translated text catalog
- expose settings for scope, batching, and judge instructions

## Evaluation Flow

The end-to-end request path is:

1. A user opens `Validation -> Translation Evaluation`.
2. A user selects a translated language and clicks `Run evaluation`.
3. `apps/studio` sends the run request with `X-OpenAI-Key` when a browser key is available.
4. `apps/api` creates a `translation-evaluation` task.
5. The API loads:
   - latest `text-catalog`
   - latest `text-catalog-translation` for the selected language
6. The API resolves configuration from `translation_evaluation`.
7. The API selects entries according to:
   - scope mode
   - scope count
   - sampling method
   - sampling seed
8. The API evaluates selected entries with the TypeScript translation judge.
9. The judge uses `@adt/llm` so calls are cached and logged through the existing LLM transparency path.
10. The API stores the result as a versioned `translation-evaluation` node.
11. Studio refreshes evaluation queries and displays the saved result.

When a needs-review item includes `suggested_text`, Studio shows an `Accept fix` action. Accepting a fix updates the selected language's `text-catalog-translation` data through the existing translation update API, creating a new version of that translated catalog. The saved evaluation result itself is not mutated; it becomes stale because the translation version has changed.

## Stored Result Model

Each stored translation evaluation result includes:

- `provider`
- `language`
- optional `source_language`
- `source_catalog_version`
- `translation_version`
- `eval_config_hash`
- `judge`
- `summary`
- `items[]`
- optional `metadata`

Each item includes:

- `entry_id`
- `acceptable`
- `source_text`
- `translated_text`
- `rationale`
- optional `issue_types`
- optional `suggested_text`

New results keep `source_text` and `translated_text` snapshots in every item for transparency. `suggested_text` is stored only when the judge marks an item as needing review and can provide a concrete corrected translation.

## Configuration

Translation evaluation is configured under `translation_evaluation` in the merged book config.
There is no separate enable switch in the current UI. Evaluation is run manually for a selected language.

Current fields:

- `judge_model`
- `max_retries`
- `evaluation_scope_mode`
- `evaluation_scope_count`
- `sampling_method`
- `sampling_seed`
- `batch_size`
- `judge_instructions`
- `additional_guidance`

Legacy compatibility is still supported for:

- `enable_translation_evaluation`
- `enabled`
- `sample_size`

These old fields are parsed by shared config resolution logic in `packages/types`, but new UI saves only the current evaluator settings.

## Evaluation Scope vs Batch Size

These two concepts are intentionally separate:

- `evaluation_scope_mode` and `evaluation_scope_count`
  - define how many entries are selected for the run
- `batch_size`
  - defines how many selected entries are processed per chunk

Example:

- scope mode = `sample`
- scope count = `50`
- batch size = `10`

This means:

- 50 entries are chosen for the run
- those 50 entries are processed in 5 batches of 10

The current runner still evaluates entries sequentially within those chunks. Parallel workers or multi-entry judge requests are future performance improvements, not part of this V1 flow.

## Sampling Behavior

Sampling is applied in the API before evaluation starts.

Supported methods:

- `sequential`
  - takes the first `N` selected entries in catalog order
- `random`
  - shuffles entries and uses the optional seed for reproducibility

If scope mode is `all`, the sampling controls are informational only and do not affect selection.

## Failure Modes

Common failure cases:

- missing `X-OpenAI-Key`
- missing server `OPENAI_API_KEY` when no browser key is sent
- no translated catalog exists for the requested language
- invalid judge model identifier
- provider failure
- returned result does not match the request versions/config hash
- accepting a suggested fix when the translated catalog no longer exists for that language

Per-entry LLM failures after retries are saved as `acceptable: false` with an error rationale and `issue_types: ["other"]`.

## What Translation Evaluation Does Not Do

This implementation does not:

- block packaging
- replace reviewer validation
- automatically run after translation generation
- update translations without explicit user acceptance
- provide a general evaluation landing page across all evaluation types
- implement a generic multi-provider evaluation framework

The current implementation is translation-focused, TypeScript-native, and stores user-visible results in ADT Studio book storage.
