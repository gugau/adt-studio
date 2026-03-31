# Upstream Accessibility Remediation Checklist

## Goal

Reduce recurring accessibility findings in packaged ADTs by fixing shared templates, page shells, wrappers, quiz/activity markup, and generated output.

This plan began as a packaged-output remediation checklist for a **new branch / new PR**.

The packaged-output remediation work is now effectively complete on this branch. The branch also now includes closely related follow-up work in these areas:

- browser-backed accessibility recheck tooling
- Validation / Preview manual-review UX cleanup

Reviewer-validation workflow work remains out of scope.

---
## Current Status

- [x] Slice 1 complete: packaged page shell now provides a shared page-level `<main>`
- [x] Slice 1 complete: shared quiz/activity invalid role output removed from packaged quiz pages
- [x] Slice 1 complete: preview, screenshot, and runtime consumers now tolerate the new shell shape
- [x] Slice 2 complete: shared section semantics were cleaned up across Liquid templates, validator cleanup, packaging normalization, and prompt instructions
- [x] Slice 4 complete: packaged image output now uses caption-backed `alt` text first, falls back to single-image `image_associated_text`, and curated regression books now carry stored caption data where shared packaging could not infer enough on its own
- [x] Slice 2 progress: shared heading strategy now promotes `section_heading` to page-level `h1` when no primary title exists
- [x] Slice 3 progress: packaging, screenshot rendering, and preview now promote the first visible heading to `h1` before falling back to a shell-only heading
- [x] Preview/export parity audit complete: sampled live preview pages now match exported ADTs on shell structure, heading counts, and image `alt` coverage across the curated regression set
- [x] Shared image-policy decision implemented: explicit `alt` wins, caption data is the primary fallback, single-image `image_associated_text` is the secondary fallback, and repeated inferred image descriptions within a section are deduplicated by setting later duplicates to `alt=""`
- [x] Final heading audit complete: the remaining shell-only pages were reviewed and documented in `.context/remaining-shell-only-headings.md`, and no further shared heading-promotion rule is warranted for this branch
- [x] Shared `activity_matching` semantics were tightened in validation, packaging, runtime, and prompts; the Grade 2 regression sample no longer shows `focus-order-semantics` or `landmark-unique` after repackaging
- [x] Shared `activity_true_false` semantics were tightened so generated/packaged output no longer relies on the prohibited radio labeling pattern seen in the Grade 2 sample
- [x] Shared `activity_fill_in_a_table` semantics were tightened so packaged/validated output now normalizes blank corner headers, row headers, and fallback input labels for the recurring Grade 2 table findings
- [x] Validation / Preview UI now distinguishes confirmed `Issues` from `Manual review` items, and severity filtering no longer mixes manual-review items into issue triage
- [x] A browser-backed accessibility recheck prototype now exists at `scripts/run-browser-a11y-recheck.ts`, with Playwright rechecking baseline `incomplete` page/rule pairs plus browser `color-contrast` findings

---

## Verification Notes

- Focused accessibility and rendering suites now pass after each slice iteration.
- Temp-copy repackaging of `books/lp-18-this-is-how-my-face-glows` first dropped `aria-allowed-role` from 7 -> 0, then dropped `image-alt` from 6 -> 0 after storing reviewed caption data.
- Temp-copy repackaging of `books/unicef-ai-strategy---main-paper-and-annexures_final` first dropped `aria-allowed-role` from 48 -> 0, then dropped `image-alt` from 18 -> 12 after the single-image `image_associated_text` fallback, and finally to 0 after storing reviewed caption data.
- A reusable local regression runner now lives at `.context/run-local-a11y-regression.sh`, and it now delegates to the repo-level candidate tool at `scripts/run-curated-a11y-regression.ts` with the committed allowlist in `scripts/curated-a11y-books.txt`.
- A reusable caption backfill helper now lives at `.context/backfill-curated-captions.ts`, with reviewed overrides in `.context/curated-caption-overrides.json` and the latest saved coverage report in `.context/caption-backfill-latest.md`.
- A rebuilt-package heading audit shows shell-only heading pages dropped from `6 -> 5` for `books/lp-18-this-is-how-my-face-glows` and from `47 -> 8` for `books/unicef-ai-strategy---main-paper-and-annexures_final`, meaning most newly packaged pages now expose a visible `h1` instead of relying solely on the shell fallback.
- A live preview/export parity audit now lives at `.context/preview-export-parity-latest.md`; the latest run samples the first three previewable pages per curated book and shows matching body classes, `<main>` / `#content` counts, heading counts, and image `alt` counts between preview and export.
- The shared image policy for this branch is now documented in code and plan scope: explicit HTML `alt` always wins, `image-captioning` is the primary fallback, single-image `image_associated_text` is the secondary fallback, and duplicate inferred descriptions within the same section become decorative repeats via `alt=""`. This branch does not guess additional decorative images beyond those shared rules.
- The latest saved local report is `.context/local-a11y-regression-latest.md` and currently shows:
  - `books/c-5-adding--subtracting--and-working-with-data--grade-2-`: `aria-allowed-role` 0 -> 0, `image-alt` 0 -> 0, caption coverage `0 / 90 -> 18 / 90`
  - `books/lp-18-this-is-how-my-face-glows`: `aria-allowed-role` 0 -> 0, `image-alt` 6 -> 0, caption coverage `0 / 10 -> 10 / 10`
  - `books/unicef-ai-strategy---main-paper-and-annexures_final`: `aria-allowed-role` 0 -> 0, `image-alt` 12 -> 0, caption coverage `0 / 22 -> 22 / 22`
  - `books/time-to-act` is now back in the curated set and is included in the committed local/browser regression runs
- The current remaining caption-coverage gap is concentrated in `books/c-5-adding--subtracting--and-working-with-data--grade-2-`, where conservative single-image heuristics improved coverage without changing its already-clean `image-alt` result.
- The latest remaining-heading review is saved in `.context/remaining-shell-only-headings.md`; it concludes that the residual shell-only pages are mostly image-first spreads, worksheet prompts, chart/data pages, or end matter, so adding another shared visible-heading heuristic would likely mislabel content rather than fix a systematic Studio flaw.
- A focused Grade 2 rerun after the `activity_matching` pass is saved in `.context/grade2-post-matching-pass.md`; it removed `focus-order-semantics` and `landmark-unique`, leaving `activity_true_false` (`aria-prohibited-attr`) and `activity_fill_in_a_table` (`empty-table-header`, `td-has-header`, `label`) as the remaining shared activity candidates at that point.
- Follow-up shared `activity_true_false` and `activity_fill_in_a_table` passes then removed the remaining recurring Grade 2 shared-activity findings, leaving the targeted inspection clean for the systematic issue families this branch set out to fix.
- The committed browser-recheck tool now lives at `scripts/run-browser-a11y-recheck.ts`, and the latest combined report is saved in `.context/browser-a11y-recheck-latest.md`.
- The latest browser report now covers all four curated books (`c-5-...`, `lp-18-...`, `unicef-...`, and `time-to-act`) and shows that many JSDOM `manual review` findings collapse to zero residual manual-review items after a real-browser recheck, while surfacing repeatable `color-contrast` / `color-contrast-enhanced` findings that JSDOM does not confirm well.
- A concrete follow-up proposal for merging JSDOM and browser-backed accessibility results in the API/UI is now documented in `.context/browser-a11y-merge-proposal.md`.
- A follow-up shared `activity_true_false` pass then removed `aria-prohibited-attr` from the Grade 2 rerun by replacing radio `aria-label` usage with generated in-label hidden text during validation/packaging and by updating the generation prompt/runtime to the same pattern.
- A final shared `activity_fill_in_a_table` pass then removed `empty-table-header`, `td-has-header`, and `label` from the Grade 2 rerun by normalizing blank corner headers / row headers / fallback input labels during validation and packaging, plus tightening the generation prompt.

## Ongoing Regression Monitoring

### Recommendation

Persisting this style of check is beneficial for ongoing regression monitoring because it validates shared output against real local books, not just synthetic fixtures.

### Keep now

- Keep `.context/run-local-a11y-regression.sh` as the one-command local audit while this remediation work is active.
- Keep the latest markdown output in `.context/local-a11y-regression-latest.md` so adjacent agents can compare before/after changes quickly.
- Re-run the local audit after any shared packaging, template, runtime, or assessment changes that could affect recurring findings.

### Do not promote as-is yet

- The committed runner candidate no longer depends on a running local app/API; it uses a curated allowlist from `scripts/curated-a11y-books.txt` and inspects local books directly.
- It still rebuilds and repackages temp copies, so it is heavier than a normal unit-test pass.
- `runAccessibilityAssessment` still emits noisy jsdom/axe warnings to stderr.
- The current decision is to keep it as repo-level developer tooling only for now, not wire it into CI.

### Likely next evolution

- Keep `scripts/run-curated-a11y-regression.ts` and `scripts/run-browser-a11y-recheck.ts` as the default developer entry points for systematic ADT-output checks.
- Keep both tools as developer tooling unless the representative-book set and runtime cost later justify CI adoption.
- Continue using the JSON mode when lightweight machine-readable trend tracking becomes useful.
- Use `scripts/run-browser-a11y-recheck.ts` when a curated book still shows many `manual review` items or when contrast needs a real-browser follow-up; it rechecks baseline `incomplete` page/rule pairs in Playwright and adds browser `color-contrast` findings.
- The latest combined browser run is saved in `.context/browser-a11y-recheck-latest.md` and now covers all four curated books, including `time-to-act`.
- The strongest candidates for permanent browser-backed automation are `color-contrast` / `color-contrast-enhanced`, plus browser-clearing of `page-has-heading-one` and `landmark-one-main` manual-review artifacts.
- The proposed next follow-up is to keep raw JSDOM and raw browser results as separate versioned nodes, add a merged API response, and have Studio default to merged results when browser data is present, as outlined in `.context/browser-a11y-merge-proposal.md`.

## Prioritized Finish List

1. **Defer non-systematic or content-specific findings**
   - Do not expand this branch into fixing every residual issue found in individual books unless a finding can be traced to shared ADT Studio output.
   - In particular, contrast/content-specific findings and book-specific caption gaps stay out of scope unless they reveal a reusable upstream flaw.

## Scope

Focus only on recurring findings that appear across many pages and/or multiple books and therefore likely come from shared ADT Studio output.

This work is **not** trying to eliminate every accessibility finding in every local book. The goal is to remove upstream ADT Studio flaws that systematically create accessibility issues across exported ADTs.

Do **not** use this PR to hide issues by suppressing rules unless a finding is clearly a tooling artifact and that decision is documented.

Include shared packaged-output issues from all of these layers:

- packaged page shell generation
- shared Liquid templates
- quiz/activity page markup
- shared CSS/theme output
- wrapper/runtime parity between export, preview, and validation

---

## Likely Problem Areas

### Shared page shell and wrapper semantics
- `packages/pipeline/src/package-web.ts`
- `packages/pipeline/src/screenshot-html.ts`
- `assets/adt/modules/navigation.js`
- `apps/studio/src/components/pipeline/stages/storyboard/components/BookPreviewFrame.tsx`

### Shared section semantics and template output
- `templates/two_column_render.liquid`
- `templates/two_column_story.liquid`
- `packages/pipeline/src/render-template.ts`
- `packages/pipeline/src/validate-html.ts`

### Quiz / activity markup
- `packages/pipeline/src/package-web.ts`
- `packages/pipeline/src/__tests__/web-rendering.test.ts`

### Headings / document outline
- `packages/pipeline/src/package-web.ts`
- `templates/`

### Image output / `alt` handling
- `packages/pipeline/src/package-web.ts`
- `templates/`
- `packages/pipeline/src/text-catalog.ts`
- `packages/types/src/image-captioning.ts`

### Shared styling / contrast
- packaged template styles
- generated CSS overrides
- theme-related shared output
- accessibility assessment config / report path

---

## Findings To Triage First

Prioritize recurring findings in roughly this order:

- `aria-allowed-role`
- `region`
- `landmark-one-main`
- `page-has-heading-one`
- `image-alt`
- `color-contrast`
- `color-contrast-enhanced`

---

## Phase 1 — Reproduce and classify

### Status
- [x] Representative books were selected, audited, and used to trace repeated findings back to shared ADT Studio output.
- [x] The relevant shared layers and wrapper consumers were identified well enough to complete the current shell, template, runtime, and image-alt remediation work.

### Remaining finish items
- [ ] Re-open Phase 1 only if a newly observed regression cannot be explained by the shared-output paths already documented in this plan and `.context/`.

### Deliverable
- [x] The verification notes plus the `.context` audit scripts now serve as the working findings matrix for this branch.

---

## Phase 2 — Fix shared landmark, wrapper, and activity semantics

### Remaining finish items
- [x] Sampled live Preview pages now match exported ADTs on the shared shell/wrapper and image-alt behaviors covered by `.context/preview-export-parity-latest.md`.

### Success criteria
- [x] Landmark/role findings drop significantly across representative books.
- [x] Quiz/activity pages no longer emit invalid shared roles.
- [x] Preview and export now behave consistently for the sampled curated pages after wrapper changes.

---

## Phase 3 — Fix heading strategy

### Remaining finish items
- [x] Review the remaining shell-only heading pages and confirm they are acceptable image-first / worksheet / data-display / end-matter cases rather than another shared heading bug.
- [x] Confirm heading semantics remain aligned with shared TOC behavior by not inventing visible headings where the source structure has no reliable heading candidate.

### Success criteria
- [x] Shared-output heading findings are reduced or eliminated on the curated regression set.
- [x] TOC generation and page-level heading behavior remain aligned for the shared rules used in this branch.

---

## Phase 4 — Fix shared image `alt` behavior

### Remaining finish items
- [x] Document and implement the shared handling for decorative images, logos / branding images, and duplicated images within this branch scope.
- [x] Confirm rendered `<img>` behavior is consistent with that shared policy on the curated regression set and preview/export parity audit.

### Success criteria
- [x] Shared-output `image-alt` findings are materially reduced.
- [x] `alt` behavior is consistent with available caption data and the shared duplicate/decorative-repeat rules implemented in this branch.

---

## Phase 5 — Review recurring contrast issues

### Status
- Deferred unless the curated regression or product validation identifies a repeatable shared contrast flaw in ADT Studio output.
- Do not expand this branch into book-specific contrast/content cleanup unless it reveals a reusable upstream defect.

### Success criteria
- [ ] If a shared contrast issue is confirmed, either fix it in this branch or explicitly defer it with rationale.

---

## Phase 6 — Add regression coverage

### Implemented coverage
- [x] Focused tests cover page shell, quiz/activity markup, heading behavior, wrapper parity assumptions, and caption-backed image `alt` behavior.
- [x] A curated repo-level regression runner candidate exists at `scripts/run-curated-a11y-regression.ts`, with `.context/run-local-a11y-regression.sh` kept as a convenience wrapper.

### Remaining finish items
- [x] Keep the committed curated runner as developer tooling only for now; do not promote it into CI in this branch.

### Success criteria
- [x] Tests cover page shell, template output, quiz/activity markup, and image-alt regressions where practical.
- [x] Systematic regressions are caught by focused tests plus the committed representative-book runner used as developer tooling.

---

## Before / After Validation

### Completed
- [x] Re-ran accessibility assessments on the same representative books used in Phase 1.
- [x] Compared repeated findings before/after.
- [x] Confirmed that the reductions come from real output fixes, not suppressed rules.

### Remaining finish items
- [x] Rechecked preview/export parity against live sampled pages with `.context/preview-export-parity-latest.md`.
- [ ] If needed before merge, do one final eyeball pass on representative quiz/activity pages in the running app.

---

## Definition Of Done

- [x] Recurring shared-output findings are materially reduced on at least 2 representative books.
- [x] Shared page-shell landmark/wrapper issues are fixed at the source.
- [x] Shared quiz/activity role issues are fixed at the source.
- [x] Shared heading cleanup is finished for the remaining cases in scope for this branch.
- [x] Shared image-policy decisions are finalized for the explicit-alt, caption-fallback, and duplicate-image cases this branch is intended to standardize.
- [x] Regression tests and curated local regression cover the corrected output patterns.
- [x] Preview/export parity still works as expected on the sampled curated pages.
- [x] Any confirmed shared contrast issue is fixed or explicitly deferred.

---

## Risks / Watchouts

- [ ] Do not suppress rules just to improve report appearance.
- [ ] Keep distinguishing shared-output problems from book-specific content issues.
- [ ] Keep distinguishing structural preview/export parity from optional final visual eyeballing in the running app.
- [ ] If a repeated finding still looks suspicious after fixes, verify whether it may be a jsdom/axe audit artifact before expanding scope.

---

## Suggested First Steps For The Next Session

- [ ] If desired before merge, do one quick visual pass on representative quiz/activity pages in the running app
- [ ] If this branch continues beyond PR prep, implement Phase 1 of the browser-merge follow-up: store `browser-accessibility-assessment` separately and add browser / merged debug endpoints
- [ ] If the merge follow-up lands later, have Studio prefer merged accessibility results and show whether browser data is missing / stale / current
- [ ] Ignore residual book-specific findings unless they can be tied back to shared ADT Studio output
- [ ] Keep the PR focused on upstream packaged-output remediation plus the already-completed accessibility-tooling/UI follow-up that supports interpreting those results
