import os
from datetime import datetime, timezone
from functools import lru_cache
from math import ceil
from typing import Literal

import mlflow
from fastapi import FastAPI, HTTPException
from mlflow.genai.judges import make_judge
from pydantic import BaseModel, Field, model_validator


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def maybe_build_run_url(tracking_uri: str | None, experiment_id: str | None, run_id: str) -> str | None:
    if not tracking_uri:
        return None
    normalized = tracking_uri.rstrip("/")
    if normalized.startswith("http://") or normalized.startswith("https://"):
        if experiment_id:
            return f"{normalized}/#/experiments/{experiment_id}/runs/{run_id}"
        return f"{normalized}/#/runs/{run_id}"
    return None


class TranslationEvaluationRunEntry(BaseModel):
    entry_id: str = Field(min_length=1)
    source_text: str
    translated_text: str


class TranslationEvaluationRunRequest(BaseModel):
    book_label: str = Field(min_length=1)
    language: str = Field(min_length=1)
    source_language: str | None = Field(default=None, min_length=1)
    source_catalog_version: int = Field(ge=1)
    translation_version: int = Field(ge=1)
    eval_config_hash: str = Field(min_length=1)
    judge_model: str | None = Field(default=None, min_length=1)
    max_retries: int | None = Field(default=None, ge=0)
    evaluation_scope_mode: Literal["all", "sample"] | None = None
    evaluation_scope_count: int | None = Field(default=None, ge=1)
    sampling_method: Literal["random", "sequential"] | None = None
    sampling_seed: int | None = None
    batch_size: int | None = Field(default=None, ge=1)
    judge_instructions: str | None = Field(default=None, min_length=1)
    additional_guidance: str | None = Field(default=None, min_length=1)
    sample_size: int | None = Field(default=None, ge=1)
    entries: list[TranslationEvaluationRunEntry] = Field(min_length=1)


IssueType = Literal[
    "meaning",
    "fluency",
    "terminology",
    "omission-or-addition",
    "formatting",
    "other",
]


class TranslationEvaluationItem(BaseModel):
    entry_id: str = Field(min_length=1)
    acceptable: bool
    source_text: str | None = None
    translated_text: str | None = None
    rationale: str = Field(min_length=1)
    issue_types: list[IssueType] | None = None


class TranslationEvaluationSummary(BaseModel):
    total: int = Field(ge=0)
    acceptable: int = Field(ge=0)
    unacceptable: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_totals(self) -> "TranslationEvaluationSummary":
        if self.acceptable + self.unacceptable != self.total:
            raise ValueError("total must equal acceptable + unacceptable")
        return self


class TranslationEvaluationMlflowMetadata(BaseModel):
    run_id: str | None = None
    experiment_id: str | None = None
    url: str | None = None


class TranslationEvaluationResult(BaseModel):
    generated_at: str
    provider: Literal["mlflow"] = "mlflow"
    language: str = Field(min_length=1)
    source_catalog_version: int = Field(ge=1)
    translation_version: int = Field(ge=1)
    eval_config_hash: str = Field(min_length=1)
    summary: TranslationEvaluationSummary
    items: list[TranslationEvaluationItem]
    mlflow: TranslationEvaluationMlflowMetadata | None = None


TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://mlflow:5000")
EXPERIMENT_NAME = os.getenv("MLFLOW_EXPERIMENT_NAME", "adt-translation-evaluation")
DATA_DIR = os.getenv("EVAL_DATA_DIR", "/app/data")
DEFAULT_JUDGE_MODEL = os.getenv("EVAL_JUDGE_MODEL", "openai:/gpt-4.1-mini")
DEFAULT_JUDGE_INSTRUCTIONS = """
Review the translation in {{ outputs }} against the source content in {{ inputs }}.

Decide whether the translation is acceptable overall.
Use these criteria:
- preserve meaning faithfully
- sound fluent and natural in the target language
- keep important terminology correct and consistent
- avoid important omissions or unsupported additions
- preserve meaningful formatting markers and placeholders when they affect meaning

Return a concise rationale for your decision.
""".strip()
DEFAULT_BATCH_SIZE = 10
ISSUE_TYPES: tuple[IssueType, ...] = (
    "meaning",
    "fluency",
    "terminology",
    "omission-or-addition",
    "formatting",
    "other",
)

os.makedirs(DATA_DIR, exist_ok=True)
mlflow.set_tracking_uri(TRACKING_URI)

app = FastAPI(title="ADT Eval Service", version="0.1.0")


def build_judge_instructions(request: TranslationEvaluationRunRequest) -> str:
    base = (request.judge_instructions or DEFAULT_JUDGE_INSTRUCTIONS).strip()
    if request.additional_guidance and request.additional_guidance.strip():
        return f"{base}\n\nAdditional guidance:\n{request.additional_guidance.strip()}"
    return base


@lru_cache(maxsize=8)
def get_acceptability_judge(model_name: str, base_instructions: str):
    instructions = f"""
{base_instructions}

Return exactly one word as your verdict: yes or no.
- yes means the translation is acceptable overall.
- no means the translation needs review.
Also provide a concise rationale.
""".strip()

    return make_judge(
        name="translation_acceptability",
        instructions=instructions,
        model=model_name,
    )


@lru_cache(maxsize=64)
def get_issue_judge(model_name: str, issue_type: IssueType, base_instructions: str):
    issue_guidance = {
        "meaning": "There is a meaning preservation problem between source and translation.",
        "fluency": "The translation is awkward, ungrammatical, or unnatural in the target language.",
        "terminology": "Important terminology is incorrect or inconsistent.",
        "omission-or-addition": "Important content is omitted or unsupported content is added.",
        "formatting": "Important formatting markers, placeholders, or structural cues are not preserved.",
        "other": "There is another material translation problem not covered above.",
    }[issue_type]
    instructions = f"""
{base_instructions}

Determine whether this specific issue is present in the translation.

Issue definition:
{issue_guidance}

The source context is in {{{{ inputs }}}} and the translation to review is {{{{ outputs }}}}.

Return exactly one word as your verdict: yes or no.
- yes means this issue is present.
- no means this issue is not present.
Also provide a concise rationale.
""".strip()

    return make_judge(
        name=f"translation_issue_{issue_type}",
        instructions=instructions,
        model=model_name,
    )


def normalize_yes_no(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        return normalized in {"yes", "true", "acceptable", "present", "1"}
    return False


def chunk_entries(entries: list[TranslationEvaluationRunEntry], batch_size: int):
    for index in range(0, len(entries), batch_size):
        yield entries[index:index + batch_size]


def evaluate_entry(entry: TranslationEvaluationRunEntry, request: TranslationEvaluationRunRequest) -> TranslationEvaluationItem:
    judge_model = request.judge_model or DEFAULT_JUDGE_MODEL
    judge_instructions = build_judge_instructions(request)
    retries = request.max_retries if request.max_retries is not None else 0
    last_error: Exception | None = None

    for attempt in range(retries + 1):
        try:
            acceptability_feedback = get_acceptability_judge(judge_model, judge_instructions)(
                inputs={
                    "entry_id": entry.entry_id,
                    "source_language": request.source_language or "",
                    "target_language": request.language,
                    "source_text": entry.source_text,
                },
                outputs=entry.translated_text,
            )
            acceptable = normalize_yes_no(acceptability_feedback.value)
            issue_types: list[IssueType] = []
            if not acceptable:
                for issue_type in ISSUE_TYPES:
                    issue_feedback = get_issue_judge(judge_model, issue_type, judge_instructions)(
                        inputs={
                            "entry_id": entry.entry_id,
                            "source_language": request.source_language or "",
                            "target_language": request.language,
                            "source_text": entry.source_text,
                        },
                        outputs=entry.translated_text,
                    )
                    if normalize_yes_no(issue_feedback.value):
                        issue_types.append(issue_type)
                if not issue_types:
                    issue_types = ["other"]

            rationale = (acceptability_feedback.rationale or "").strip() or "MLflow judge returned no rationale."
            return TranslationEvaluationItem(
                entry_id=entry.entry_id,
                acceptable=acceptable,
                source_text=entry.source_text,
                translated_text=entry.translated_text,
                rationale=rationale,
                issue_types=issue_types,
            )
        except Exception as exc:
            last_error = exc
            if attempt >= retries:
                break

    error_message = str(last_error) if last_error else "Unknown judge failure"
    return TranslationEvaluationItem(
        entry_id=entry.entry_id,
        acceptable=False,
        source_text=entry.source_text,
        translated_text=entry.translated_text,
        rationale=f"MLflow judge call failed: {error_message}",
        issue_types=["other"],
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/evaluate/translation", response_model=TranslationEvaluationResult)
def evaluate_translation(request: TranslationEvaluationRunRequest) -> TranslationEvaluationResult:
    try:
        experiment = mlflow.set_experiment(EXPERIMENT_NAME)
    except Exception as exc:  # pragma: no cover - container/runtime concern
        raise HTTPException(status_code=500, detail=f"Failed to initialize MLflow experiment: {exc}") from exc

    try:
        with mlflow.start_run(run_name=f"{request.book_label}:{request.language}:translation-eval") as run:
            mlflow.log_params(
                {
                    "book_label": request.book_label,
                    "language": request.language,
                    "source_language": request.source_language or "",
                    "source_catalog_version": request.source_catalog_version,
                    "translation_version": request.translation_version,
                    "eval_config_hash": request.eval_config_hash,
                    "judge_model": request.judge_model or "",
                    "max_retries": request.max_retries if request.max_retries is not None else "",
                    "evaluation_scope_mode": request.evaluation_scope_mode or "",
                    "evaluation_scope_count": request.evaluation_scope_count if request.evaluation_scope_count is not None else "",
                    "sampling_method": request.sampling_method or "",
                    "sampling_seed": request.sampling_seed if request.sampling_seed is not None else "",
                    "batch_size": request.batch_size if request.batch_size is not None else "",
                    "judge_instructions": request.judge_instructions or DEFAULT_JUDGE_INSTRUCTIONS,
                    "additional_guidance": request.additional_guidance or "",
                    "sample_size": request.sample_size if request.sample_size is not None else "",
                    "entry_count": len(request.entries),
                    "judge_type": "mlflow-make-judge",
                }
            )
            mlflow.log_dict(request.model_dump(mode="json"), "inputs/translation-evaluation-request.json")

            batch_size = request.batch_size or DEFAULT_BATCH_SIZE
            total_batches = max(1, ceil(len(request.entries) / batch_size))
            items: list[TranslationEvaluationItem] = []
            for batch_index, batch in enumerate(chunk_entries(request.entries, batch_size), start=1):
                items.extend([evaluate_entry(entry, request) for entry in batch])
                mlflow.log_metric("configured_batch_size", batch_size)
                mlflow.log_metric("processed_batches", batch_index)
                mlflow.log_metric("total_batches", total_batches)
            acceptable_count = sum(1 for item in items if item.acceptable)
            result = TranslationEvaluationResult(
                generated_at=utc_now(),
                language=request.language,
                source_catalog_version=request.source_catalog_version,
                translation_version=request.translation_version,
                eval_config_hash=request.eval_config_hash,
                summary=TranslationEvaluationSummary(
                    total=len(items),
                    acceptable=acceptable_count,
                    unacceptable=len(items) - acceptable_count,
                ),
                items=items,
                mlflow=TranslationEvaluationMlflowMetadata(
                    run_id=run.info.run_id,
                    experiment_id=experiment.experiment_id if experiment else None,
                    url=maybe_build_run_url(TRACKING_URI, experiment.experiment_id if experiment else None, run.info.run_id),
                ),
            )
            mlflow.log_metric("total_entries", len(items))
            mlflow.log_metric("acceptable_entries", acceptable_count)
            mlflow.log_metric("unacceptable_entries", len(items) - acceptable_count)
            mlflow.log_dict(result.model_dump(mode="json"), "outputs/translation-evaluation-result.json")
            return result
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - container/runtime concern
        raise HTTPException(status_code=500, detail=f"Translation evaluation failed: {exc}") from exc
