# Translation Evaluation

This document describes the translation evaluation feature in ADT Studio: what it does, how it is configured, and how evaluation requests flow through the TypeScript API.

## Overview

Translation evaluation is an optional validation workflow for translated `text-catalog` content.

It answers one question for each translated entry:

- is this translation acceptable as-is?
- if not, why does it need review?

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
- expose settings for scope, batching, and judge instructions

## Evaluation Flow

The end-to-end request path is:

1. A user enables translation evaluation in Validation settings.
2. A user opens `Validation -> Translation Evaluation`.
3. A user selects a translated language and clicks `Run evaluation`.
4. `apps/studio` sends the run request with `X-OpenAI-Key`.
5. `apps/api` creates a `translation-evaluation` task.
6. The API loads:
   - latest `text-catalog`
   - latest `text-catalog-translation` for the selected language
7. The API resolves configuration from `translation_evaluation`.
8. The API selects entries according to:
   - scope mode
   - scope count
   - sampling method
   - sampling seed
9. The API evaluates selected entries with the TypeScript translation judge.
10. The judge uses `@adt/llm` so calls are cached and logged through the existing LLM transparency path.
11. The API stores the result as a versioned `translation-evaluation` node.
12. Studio refreshes evaluation queries and displays the saved result.

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

New results keep `source_text` and `translated_text` snapshots in every item for transparency.

## Configuration

Translation evaluation is configured under `translation_evaluation` in the merged book config.

Current fields:

- `enable_translation_evaluation`
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

- `enabled`
- `sample_size`

These old fields are mapped into the new structure by shared config resolution logic in `packages/types`.

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

- translation evaluation is disabled in book settings
- missing `X-OpenAI-Key`
- no translated catalog exists for the requested language
- invalid judge model identifier
- provider failure
- returned result does not match the request versions/config hash

Per-entry LLM failures after retries are saved as `acceptable: false` with an error rationale and `issue_types: ["other"]`.

## What Translation Evaluation Does Not Do

This implementation does not:

- block packaging
- replace reviewer validation
- implement a generic multi-provider evaluation framework

The current implementation is translation-focused, TypeScript-native, and stores user-visible results in ADT Studio book storage.
