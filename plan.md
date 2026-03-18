# Accessibility Assessment Plan

## Purpose

This branch adds automated accessibility assessment and reviewer validation to ADT Studio and surfaces the results in the Validation step and the Preview workflow.

This document reflects the **current scope of this branch/PR** and separates it from a second, follow-up stream of work: **upstream accessibility fixes in the shared ADT templates and packaging wrappers**.

Those upstream fixes appear to be largely independent of the assessment features and should land in a separate branch/PR.

---

## Scope of this PR

### Goal

Port the automated accessibility assessment capability into ADT Studio so users can:

- run accessibility checks as part of packaging,
- store results as versioned book data,
- inspect book-wide and page-level findings in Studio,
- review findings while previewing a page,
- configure which axe checks are enabled or disabled per document.

### What is included

#### 1. Package-stage accessibility assessment

An `axe-core`-based accessibility assessment now runs as part of the package flow.

Implemented in:

- `packages/types/src/pipeline.ts`
- `packages/pipeline/src/accessibility-assessment.ts`
- `packages/pipeline/src/pipeline-dag.ts`
- `apps/api/src/routes/package.ts`

This assessment:

- audits packaged ADT HTML pages,
- stores the result as versioned `node_data`,
- records page-level violations, incomplete/manual-review checks, and summary counts,
- respects per-book configuration for enabled tags and disabled rules.

#### 2. Shared schemas and typed storage

Accessibility assessment schemas are defined in:

- `packages/types/src/accessibility.ts`
- `packages/types/src/config.ts`

These cover:

- assessment output,
- page-level findings,
- finding nodes,
- summary information,
- book-level accessibility assessment configuration.

#### 3. Validation step and Studio UI

Accessibility results are exposed through the debug API, but the primary Studio surface now lives in the dedicated `Validation` stage rather than in the debug panel.

Implemented in:

- `apps/api/src/routes/debug.ts`
- `apps/studio/src/api/client.ts`
- `apps/studio/src/hooks/use-debug.ts`
- `apps/studio/src/components/pipeline/stages/ValidationView.tsx`
- `apps/studio/src/components/debug/AccessibilityTab.tsx`

The `Validation` stage currently includes top-level tabs for:

- `Accessibility Summary`
- `Accessibility Config`
- `Reviewer Validation`

The debug panel has been reduced back to its original non-accessibility tabs.

#### 4. Preview accessibility and reviewer-validation UX

Preview now includes lightweight accessibility and reviewer-validation surfaces.

Implemented in:

- `apps/studio/src/components/pipeline/stages/PreviewView.tsx`
- `apps/studio/src/components/pipeline/stages/PreviewAccessibilityCard.tsx`
- `apps/studio/src/components/debug/debug-panel-state.tsx`

This includes:

- a collapsible Accessibility summary card,
- current-page findings summary,
- a collapsible Validation card for page-level reviewer checks,
- deep-linking from Preview into the Validation stage,
- inline highlight mode for flagged elements,
- hover inspector tooltip for highlighted elements,
- suppression of collapsed cards while larger UI surfaces are open,
- delayed/faded reappearance of collapsed cards after the debug panel closes.

#### 5. Document-level assessment configuration

Accessibility assessment options are now part of document config.

Implemented in:

- `packages/types/src/config.ts`
- `packages/pipeline/src/accessibility-assessment.ts`
- `apps/studio/src/components/debug/AccessibilityTab.tsx`
- `apps/studio/src/components/debug/ConfigTab.tsx`

Current supported options:

- `accessibility_assessment.run_only_tags`
- `accessibility_assessment.disabled_rules`

This allows a document to override the default enabled axe tags or disable known noisy checks such as `color-contrast`.

#### 6. Book-wide findings summarization

Accessibility Overview now distinguishes between broad themes and repeated rules.

Implemented in:

- `apps/studio/src/lib/accessibility-summary.ts`
- `apps/studio/src/components/debug/AccessibilityTab.tsx`

This includes:

- severity distribution,
- finding categories,
- most frequently observed findings,
- separation of recurring findings vs page-specific findings,
- page coverage indicators to help distinguish template-wide issues from one-off page issues.

---

## Status of original milestones

### M1 — Package-stage assessment

**Status: complete**

Delivered:

- shared schemas,
- package-stage assessment step,
- raw `axe-core` assessment runner,
- versioned storage of results.

### M2 — API + Studio debug surfaces

**Status: complete**

Delivered:

- debug API endpoint for latest assessment,
- Studio debug rendering,
- page-level inspection support.

### M3 — History and raw JSON affordances

**Status: complete**

Delivered:

- version history access,
- raw JSON download,
- Accessibility Overview improvements.

### Additional Preview work beyond M1–M3

**Status: complete in this branch**

Delivered:

- Preview Accessibility card,
- Preview Validation card,
- Preview-to-Validation deep-linking,
- inline highlight mode,
- hover inspector,
- reviewer validation sessions and per-page checklist persistence,
- document-level assessment configuration UI.

---

## What is intentionally not included in this PR

This branch does **not** attempt to fix the upstream HTML/template issues that are causing many accessibility findings to appear across all pages of a book.

Those fixes are important, but they are a separate concern from:

- adding the assessment engine,
- storing and surfacing results,
- giving users tools to inspect and act on the findings.

Keeping them separate should make this PR easier to review and lower-risk to merge.

---

## Reviewer validation applicability pattern

Reviewer validation now uses a **derived-applicability** pattern for feature-dependent checklist items.

The rule is:

- if a reviewer has explicitly saved a status for a criterion, that explicit status always wins,
- otherwise, the UI may derive `N/A` when a prerequisite feature or output is unavailable,
- derived defaults are **not** persisted as canonical review decisions.

This is important because feature availability can change after a reviewer session begins. For example:

- `Glossary` may be unavailable when the reviewer starts,
- `Text & Speech` or language-specific `Translation` may be generated later,
- image-related checks may be inapplicable on one page but applicable on another.

Current derived applicability lives in:

- `apps/studio/src/lib/reviewer-validation-defaults.ts`
- `apps/studio/src/lib/reviewer-validation-applicability.ts`
- `apps/studio/src/components/pipeline/stages/PreviewValidationCard.tsx`

Current derived `N/A` cases include:

- `Visual media & image description` when the current page has no images,
- `Easy-read` when no Easy Read output exists,
- `Glossary` when glossary output has not been generated,
- `Audio and voice-over` when Text & Speech audio is unavailable,
- `Translation` when no translation output exists for the reviewer session language.

Future follow-up PRs should preserve this pattern:

- keep applicability logic separate from persisted reviewer-authored data,
- persist only explicit reviewer choices,
- store user-facing default-reason copy in shared helpers,
- prefer shared applicability helpers over re-implementing rules in individual components.

---

## Findings from the UNICEF AI Strategy book

I reviewed the latest stored accessibility assessment for:

- `books/unicef-ai-strategy---main-paper-and-annexures_final`

The latest assessment shows:

- `74` pages audited,
- `74` pages with violations,
- `147` violations,
- `148` incomplete/manual-review findings.

The most frequently observed findings are:

- `aria-allowed-role` on `74/74` pages
- `landmark-one-main` on `74/74` pages
- `page-has-heading-one` on `74/74` pages
- `region` on `73/74` pages

The affected nodes are shared/generated markup, not book-specific content:

- `#simple-main`
- `.opacity-0`
- `html`

This strongly suggests that many of the recurring findings are rooted in shared ADT Studio templates/wrappers rather than in this specific book’s authored content.

### Relevant source locations

Shared template markup currently includes:

- `templates/two_column_story.liquid`
- `templates/two_column_render.liquid`

These templates render markup such as:

- `<section role="article" ...>`

Shared package wrapper logic currently includes:

- `packages/pipeline/src/package-web.ts`

This file currently wraps page content in markup such as:

- `<div id="content" class="opacity-0"> ... </div>`

The combination of these shared structures likely explains most of the recurring findings.

---

## Assessment of those recurring findings

### 1. `aria-allowed-role`

This appears to be a real shared-template issue.

Likely cause:

- use of `role="article"` on a `section` element in shared templates.

Likely remediation:

- remove the explicit ARIA role,
- or replace the element with a more appropriate semantic element if `article` is the intended meaning.

### 2. `region`

This appears to be a real shared wrapper/landmark issue.

Likely cause:

- the outer `.opacity-0` wrapper is not part of a valid landmark structure,
- some page content is therefore seen as not contained by landmarks.

Likely remediation:

- make the outer page content wrapper itself a landmark,
- or move the hide/show behavior to an element already inside a proper landmark.

### 3. `landmark-one-main`

This likely points to a real missing-main-landmark problem, though the current `incomplete` status suggests the audit environment may also be a factor.

Likely remediation:

- ensure every packaged page contains a single programmatic `<main>` landmark,
- keep primary content within that `<main>`.

### 4. `page-has-heading-one`

This one should be treated more cautiously.

Some generated pages visibly contain `<h1>` content, so the fact this is `incomplete` across all pages suggests one of two things:

- some pages still genuinely lack a reliable top-level heading,
- and/or the current jsdom-based audit path is not fully representing the rendered page structure for this rule.

Likely remediation:

- ensure every page has a guaranteed primary heading,
- add a fallback hidden heading where templates do not naturally emit one,
- later evaluate whether browser-based auditing would reduce false/manual-review results here.

---

## Proposed follow-up branch / PR: upstream accessibility remediation

### Goal

Reduce template-wide accessibility findings in packaged ADTs by fixing shared semantics and wrapper structure in the generated HTML.

### Recommended scope

#### Phase 1 — Fix landmark and role structure

Update shared templates and page wrappers so that generated ADT pages have a more appropriate semantic structure.

Primary targets:

- `packages/pipeline/src/package-web.ts`
- `templates/two_column_story.liquid`
- `templates/two_column_render.liquid`

Recommended changes:

- remove `role="article"` from shared `section` markup,
- introduce a single `<main>` landmark for the page,
- ensure visible page content sits inside that `<main>`,
- avoid placing meaningful content in a non-landmark wrapper outside the main content region.

Expected impact:

- reduce or eliminate `aria-allowed-role`
- reduce or eliminate `region`
- reduce or eliminate `landmark-one-main`

#### Phase 2 — Guarantee page heading structure

Ensure every packaged page exposes a clear primary heading.

Recommended changes:

- audit template variants for heading output,
- ensure there is one reliable top-level heading per page,
- add a fallback heading strategy for pages that currently do not emit one naturally,
- avoid multiple peer `<h1>` elements where a clearer hierarchy is possible.

Expected impact:

- reduce `page-has-heading-one`
- improve real navigability for screen-reader users

#### Phase 3 — Add regression tests around generated HTML semantics

Add focused tests for packaged output semantics.

Recommended test targets:

- `packages/pipeline/src/__tests__/web-rendering.test.ts`
- `packages/pipeline/src/__tests__/validate-html.test.ts`

Recommended assertions:

- each packaged page has exactly one `<main>` landmark,
- primary content is contained within landmarks,
- invalid shared ARIA role usage is absent,
- each page has a valid top-level heading strategy.

#### Phase 4 — Revisit audit fidelity

Evaluate whether some current incomplete/manual-review results are artifacts of the current assessment environment rather than true user-facing accessibility failures.

Possible follow-up:

- keep the current fast jsdom-based pass,
- add an optional browser-based audit path later for higher-fidelity checks.

This is especially relevant for rules like:

- `page-has-heading-one`
- `landmark-one-main`

where the current assessment is returning `incomplete` rather than clear pass/fail results.

---

## Recommended PR split

### PR 1 — This branch

Ship the accessibility assessment feature set:

- package-stage audits,
- versioned storage,
- debug UI,
- Preview accessibility UX,
- config support,
- recurring-finding summaries.

### PR 2 — Follow-up branch

Ship shared semantic/template remediation:

- landmark fixes,
- wrapper fixes,
- heading structure fixes,
- regression tests for generated HTML semantics.

This split keeps feature delivery and upstream HTML cleanup separate, which should make review, testing, and rollback safer.

---

## Validation completed on this branch

This branch has been validated during implementation with repeated targeted and full checks, including:

- `pnpm build`
- focused `vitest` runs for accessibility summary logic
- broader package/debug route tests earlier in the branch lifecycle

---

## Next step after opening this PR

Create a new branch/PR focused specifically on shared HTML semantics and packaged output accessibility remediation.

That follow-up should begin with the shared wrapper/template fixes, because the current repeated findings strongly suggest those changes will have the biggest book-wide impact.
