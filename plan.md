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
- `apps/studio/src/components/validation/AccessibilityValidationTabs.tsx`

The `Validation` stage currently includes top-level tabs for:

- `Accessibility Summary`
- `Reviewer Validation`

Accessibility configuration now lives behind the Validation stage gear icon in the left sidebar and is rendered through the step settings route rather than as a peer Validation tab.

The debug panel has been reduced back to its original non-accessibility tabs.

#### 4. Preview accessibility and reviewer-validation UX

Preview now includes lightweight accessibility and reviewer-validation surfaces.

Implemented in:

- `apps/studio/src/components/pipeline/stages/PreviewView.tsx`
- `apps/studio/src/components/pipeline/stages/PreviewAccessibilityCard.tsx`
- `apps/studio/src/components/pipeline/stages/PreviewValidationCard.tsx`

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
- `apps/studio/src/components/pipeline/StageSidebar.tsx`
- `apps/studio/src/components/pipeline/stages/ValidationSettings.tsx`
- `apps/studio/src/routes/books.$label.$step.settings.tsx`

Current supported options:

- `accessibility_assessment.run_only_tags`
- `accessibility_assessment.disabled_rules`

This allows a document to override the default enabled axe tags or disable known noisy checks such as `color-contrast`.

#### 6. Book-wide findings summarization

Accessibility Overview now distinguishes between broad themes and repeated rules.

Implemented in:

- `apps/studio/src/lib/accessibility-summary.ts`
- `apps/studio/src/components/validation/AccessibilityValidationTabs.tsx`

This includes:

- severity distribution,
- clickable severity drill-down with affected-page links,
- finding categories,
- clickable category drill-down with affected-page links,
- recurring book-wide findings,
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
- `Interactivity` when the current page has no activity/exercise block.
- `Sign language` when sign-language output is not enabled in the packaged page.

Future follow-up PRs should preserve this pattern:

- keep applicability logic separate from persisted reviewer-authored data,
- persist only explicit reviewer choices,
- store user-facing default-reason copy in shared helpers,
- prefer shared applicability helpers over re-implementing rules in individual components.

---

## Findings from recent book assessments

I reviewed the latest stored accessibility assessments for:

- `books/unicef-ai-strategy---main-paper-and-annexures_final`
- `books/time-to-act`

### Latest assessment snapshots

#### UNICEF AI Strategy (`generatedAt: 2026-03-18T09:40:33.259Z`)

- `74` pages audited
- `147` violations
- `294` incomplete/manual-review findings

Most frequent findings:

- `aria-allowed-role` on `74/74` pages
- `landmark-one-main` on `74/74` pages
- `page-has-heading-one` on `74/74` pages
- `color-contrast` on `73/74` pages
- `color-contrast-enhanced` on `73/74` pages
- `region` on `73/74` pages

Representative selectors:

- `#simple-main`
- `#content`
- `html`
- `h1`

#### Time to Act (`generatedAt: 2026-03-23T10:05:03.008Z`)

- `16` pages audited
- `49` violations
- `48` incomplete/manual-review findings

Most frequent findings:

- `aria-allowed-role` on `16/16` pages
- `image-alt` on `16/16` pages
- `landmark-one-main` on `16/16` pages
- `page-has-heading-one` on `16/16` pages
- `region` on `16/16` pages
- `color-contrast-enhanced` on `16/16` pages

Representative selectors:

- `section`
- `img`
- `#content`
- `html`

### Cross-book observations

Several findings recur across most or all pages in **multiple books**, which strongly suggests platform-level issues in shared ADT templates, wrappers, or styling rather than problems unique to a single source book.

The strongest repeated patterns are:

#### 1. Shared landmark/role structure issues

The following findings recur across both books:

- `aria-allowed-role`
- `landmark-one-main`
- `page-has-heading-one`
- `region`

These map cleanly to shared code:

- `templates/two_column_render.liquid:1` wraps content in `<div id="content">`
- `templates/two_column_render.liquid:2` uses `<section role="article">`
- `templates/two_column_story.liquid:31` wraps content in `<div id="content">`
- `templates/two_column_story.liquid:32` uses `<section role="article">`
- `packages/pipeline/src/package-web.ts:897` wraps quiz/activity pages in `<div id="content" ... opacity-0>`
- `packages/pipeline/src/package-web.ts:899` uses `<section id="simple-main" role="activity">`
- `packages/pipeline/src/screenshot-html.ts:61` injects a fallback `<div id="content">` wrapper when absent

This is important because the selectors reported by the assessment line up with those exact shared wrappers:

- `#content` appears in `region`
- `#simple-main` appears in `aria-allowed-role`
- `html` appears in `landmark-one-main` and `page-has-heading-one`

#### 2. Missing/invalid landmark semantics are likely real defects

Likely interpretation:

- `role="article"` on `section` is causing `aria-allowed-role` for standard content pages
- `role="activity"` on `#simple-main` is causing `aria-allowed-role` for quiz/activity pages
- the current wrappers do not provide a single reliable `<main>` landmark
- meaningful content is often placed inside `#content` without a proper containing landmark

Likely consequences:

- `landmark-one-main`
- `region`
- part of the `page-has-heading-one` noise when the main page structure is not clearly represented

#### 3. Images without `alt` appear to be a template/process issue, not just a book issue

The `time-to-act` book shows `image-alt` on `16/16` pages. That is not just a content signal; shared templates are currently rendering `<img>` tags without `alt` attributes:

- `templates/two_column_render.liquid:17`
- `templates/two_column_render.liquid:25`
- `templates/two_column_render.liquid:77`
- `templates/two_column_render.liquid:85`
- `templates/two_column_story.liquid:39`
- `templates/two_column_story.liquid:51`

So even if image captions/descriptions exist elsewhere in the pipeline, the generated page HTML is often omitting the most basic image alternative text hook.

Two codebase follow-ups stand out here:

- `packages/pipeline/src/validate-html.ts` currently validates image `data-id` structure but does not enforce `alt` presence, so template regressions can slip through.
- several pipeline tests still encode the old shared markup shape (`<div id="content">`, `<section role="article">`) and often use hand-authored `<img ... alt="test" />`, which masks the fact that the real templates omit `alt`.

This should be treated as a high-priority upstream remediation item.

#### 4. Color-contrast findings are likely a mix of template and content/theme issues

Color contrast is now appearing at large scale, especially in the UNICEF book:

- `color-contrast` on `73/74` pages
- `color-contrast-enhanced` on `73/74` pages

The selectors include repeated low-level typography targets such as:

- `h1`
- `p`
- `.text-sky-600`
- `.text-sm`

This suggests that some contrast failures are being driven by shared template/style decisions and styleguide color choices, not just by individual authored pages.

These findings are likely worth splitting into a separate remediation stream from the landmark fixes because they may require:

- auditing shared Tailwind classes in templates
- reviewing default palette choices in styleguides/presets
- deciding whether `color-contrast-enhanced` should remain enabled by default or be treated as a stricter opt-in mode

#### 5. `page-has-heading-one` still needs careful interpretation

This finding is still appearing on every page in both books, always on `html`.

That suggests one or both of the following:

- some templates/pages genuinely do not guarantee a reliable `<h1>`
- the current jsdom-based audit path is not always seeing the final effective heading structure the way a browser-driven audit would

So this finding should not be dismissed, but it should be treated as partly structural and possibly partly audit-fidelity-related.

### Suggestions for upstream remediation

#### Priority 1 — Fix shared role and landmark semantics

Recommended changes:

- remove `role="article"` from shared template `section` elements
- remove `role="activity"` from the quiz/activity wrapper unless there is a standards-based ARIA equivalent that is actually valid here
- add a single reliable `<main>` landmark to every packaged page
- ensure `#content` is either itself the main landmark or lives inside the main landmark, not outside it

Primary files:

- `templates/two_column_render.liquid`
- `templates/two_column_story.liquid`
- `packages/pipeline/src/package-web.ts`
- `packages/pipeline/src/screenshot-html.ts`

Expected impact:

- reduce `aria-allowed-role`
- reduce `landmark-one-main`
- reduce `region`

#### Priority 2 — Guarantee image alt text in generated HTML

Recommended changes:

- update shared templates to emit `alt` on all rendered `<img>` tags
- decide the source of truth for the `alt` value (caption text, image metadata, dedicated alt text field, or empty alt for decorative images)
- add tests that fail when generated templates emit `<img>` without `alt`

Primary files:

- `templates/two_column_render.liquid`
- `templates/two_column_story.liquid`
- `packages/pipeline/src/__tests__/web-rendering.test.ts`
- `packages/pipeline/src/__tests__/validate-html.test.ts`

Expected impact:

- reduce `image-alt`
- make image accessibility much less dependent on downstream manual remediation

#### Priority 3 — Review heading strategy across shared templates

Recommended changes:

- ensure every page variant produces one reliable top-level heading
- avoid relying on only conditional content types to emit `<h1>`
- consider a fallback hidden heading when a page otherwise has no semantic heading

Expected impact:

- reduce `page-has-heading-one`
- improve actual screen-reader navigation

#### Priority 4 — Audit shared style choices for contrast

Recommended changes:

- review repeated typography/color combinations used by shared templates and styleguides
- test common heading/body/link/button classes against the current assessment defaults
- decide whether `color-contrast-enhanced` should stay enabled by default or become an explicitly stricter profile

Expected impact:

- reduce recurring contrast findings without blurring the line between product-level defects and content-level defects

#### Priority 5 — Update regression fixtures so they stop encoding problematic semantics

Recommended changes:

- update `packages/pipeline/src/__tests__/web-rendering.test.ts` fixtures so they no longer normalize around `<section role="article">` and the old wrapper assumptions
- update `packages/pipeline/src/__tests__/validate-html.test.ts` fixtures so landmark and heading expectations match the intended packaged HTML structure
- add explicit fixture coverage for missing `alt`, invalid roles, and absent `<main>` so these shared regressions fail loudly

Expected impact:

- prevents the current problematic wrapper semantics from being reintroduced through tests
- aligns package/rendering tests with the same accessibility guarantees we now surface in Validation

### Suggested follow-up implementation approach

A pragmatic next branch/PR could be structured as:

1. fix landmark/role semantics first
2. add `alt` attribute support for all shared image templates
3. add regression tests for generated HTML semantics and image accessibility
4. rerun the same two books and compare whether the recurring counts collapse
5. only then revisit contrast and heading issues that remain

This should make it easier to tell which problems were truly platform-wide and which are still book/content-specific.

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
- Validation and Preview UX,
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
