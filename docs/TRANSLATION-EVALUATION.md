# Translation Evaluation

This document describes the translation evaluation feature in ADT Studio: what it does, which services it depends on, how it is configured, and how the evaluation request flows through the system.

## Overview

Translation evaluation is an optional validation workflow for translated `text-catalog` content.

It is designed to answer one question for each translated entry:

- is this translation acceptable as-is?
- if not, why does it need review?

The current implementation uses:

- ADT Studio as the system of record for books, versions, and UI
- an external `eval-service` as the execution boundary for evaluations
- MLflow `make_judge` inside the eval service
- MLflow tracking for run metadata, artifacts, and run history

ADT Studio does **not** read evaluation results back from MLflow directly. The API only shows results in the Studio UI after the eval service returns a normalized payload and the API stores that payload as a versioned `translation-evaluation` node in the book database.

## Deployment Topology

For local Docker Compose usage, translation evaluation introduces two additional services beyond the normal ADT Studio stack:

- `eval-service`
  - Python/FastAPI worker
  - receives normalized translation-evaluation requests from `apps/api`
  - runs MLflow `make_judge`
  - returns normalized evaluation results
- `mlflow`
  - MLflow tracking server
  - stores run metadata and artifacts for each evaluation run

Current Compose topology:

```text
browser
  |
  v
studio (nginx)
  |
  v
api (Hono)
  |
  +--> eval-service (FastAPI + MLflow make_judge)
           |
           v
         mlflow
```

Relevant local volumes in `docker-compose.yml`:

- `./books:/app/books`
  - ADT Studio book storage
- `./eval-data:/app/data`
  - eval-service local runtime data
- `./mlflow:/mlflow`
  - MLflow database and artifacts

Relevant environment variables:

- `EVAL_SERVICE_URL`
- `EVAL_SERVICE_TOKEN`
- `MLFLOW_TRACKING_URI`
- `MLFLOW_TRACKING_TOKEN`
- `MLFLOW_EXPERIMENT_NAME`
- `MLFLOW_PORT`
- `OPENAI_API_KEY`

When `EVAL_SERVICE_URL` is unset, the Translation Evaluation UI remains visible but new runs cannot be submitted.

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
- request/response payload shapes between ADT Studio and the eval service
- stored evaluation result shape in the book database

### 2. API orchestration

Files:

- [`apps/api/src/routes/translation-evaluations.ts`](../apps/api/src/routes/translation-evaluations.ts)
- [`apps/api/src/services/translation-evaluation-service.ts`](../apps/api/src/services/translation-evaluation-service.ts)
- [`apps/api/src/services/eval-service-client.ts`](../apps/api/src/services/eval-service-client.ts)

Responsibilities:

- validate route inputs
- load the latest source and translated text catalog versions
- resolve evaluation settings
- apply evaluation scope and sampling
- submit a background `translation-evaluation` task
- send the normalized run request to the eval service
- validate the returned result
- store the result locally as a versioned `translation-evaluation` artifact

### 3. Studio UI

Files:

- [`apps/studio/src/components/validation/TranslationEvaluationTab.tsx`](../apps/studio/src/components/validation/TranslationEvaluationTab.tsx)
- [`apps/studio/src/components/validation/TranslationEvaluationSettingsTab.tsx`](../apps/studio/src/components/validation/TranslationEvaluationSettingsTab.tsx)
- [`apps/studio/src/hooks/use-translation-evaluation.ts`](../apps/studio/src/hooks/use-translation-evaluation.ts)

Integration points:

- Validation results tab
- Validation settings tab
- Text & Speech status badges and entry-level indicators

Responsibilities:

- run evaluations
- show task progress
- show stored results by language
- expose settings for scope, batching, and judge instructions
- keep the detailed review surface in Validation while surfacing lightweight status in Text & Speech

### 4. Eval service

Files:

- [`services/eval-service/app/main.py`](../services/eval-service/app/main.py)
- [`docker/eval-service.Dockerfile`](../docker/eval-service.Dockerfile)

Responsibilities:

- receive a normalized `TranslationEvaluationRunRequest`
- construct MLflow `make_judge` prompts
- evaluate entries in batches
- classify entries as acceptable or needs review
- assign issue types when needed
- log run metadata and artifacts to MLflow
- return a normalized `TranslationEvaluationResult`

## Evaluation Flow

The end-to-end request path is:

1. A user enables translation evaluation in Validation settings.
2. A user opens `Validation -> Translation Evaluation`.
3. A user selects a translated language and clicks `Run evaluation`.
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
8. The API sends a normalized request to `eval-service`.
9. `eval-service` evaluates the selected entries with MLflow `make_judge`.
10. `eval-service` logs run metadata and request/result artifacts to MLflow.
11. `eval-service` returns a normalized result payload to the API.
12. The API stores the result as a versioned `translation-evaluation` node.
13. Studio refreshes evaluation queries and displays the saved result.

## Stored Result Model

Each stored translation evaluation result includes:

- `language`
- `source_catalog_version`
- `translation_version`
- `eval_config_hash`
- `summary`
- `items[]`
- optional MLflow metadata

Each item includes:

- `entry_id`
- `acceptable`
- `source_text`
- `translated_text`
- `rationale`
- optional `issue_types`

This keeps the UI independent from MLflow’s native response shape.

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
  - define **how many entries are selected for the run**
- `batch_size`
  - defines **how many of those selected entries are processed per chunk**

Example:

- scope mode = `sample`
- scope count = `50`
- batch size = `10`

This means:

- 50 entries are chosen for the run
- those 50 entries are processed in 5 batches of 10

## Sampling Behavior

Sampling is applied in the API before the request is sent to the eval service.

Supported methods:

- `sequential`
  - takes the first `N` selected entries in catalog order
- `random`
  - shuffles entries and uses the optional seed for reproducibility

If scope mode is `all`, the sampling controls are informational only and do not affect selection.

## MLflow Logging

Each evaluation run logs:

- book/language/version identifiers
- judge model
- scope and sampling config
- batch size
- judge instructions
- additional guidance
- entry count
- normalized request artifact
- normalized result artifact

This gives operators a run history in MLflow while keeping ADT Studio as the source of truth for what the user sees in the app.

## UI Behavior

### Validation

The main evaluation surface is in:

- `Validation -> Translation Evaluation`

It shows:

- selected language
- current/stale state
- summary counts
- issue type rollups
- result cards per entry
- active task/progress status

### Text & Speech

The Text & Speech screen shows only lightweight evaluation signals:

- language-level status badge
- `View eval` link into Validation
- per-entry `OK` / `Review` badges where evaluation data exists

## Failure Modes

Common failure cases:

- `EVAL_SERVICE_URL` not configured
- no translated catalog exists for the requested language
- invalid judge model URI
- MLflow worker/provider failure
- returned result does not match the request versions/config hash

MLflow runs may exist even when Studio does not show a new result yet. Studio only updates after the API task finishes successfully and stores the returned result locally.

## What Translation Evaluation Does Not Do

This implementation does **not**:

- block packaging
- replace reviewer validation
- read results directly from MLflow
- treat MLflow as the source of truth for user-facing results
- implement a generic multi-provider evaluation framework

The current implementation is translation-focused and MLflow-backed, with ADT Studio retaining ownership of stored results and UI state.
