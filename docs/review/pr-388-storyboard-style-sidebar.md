# PR #388 Bug Review — Storyboard Style Sidebar

Branch: `eliezir/style-sidebar` vs `main`. ~8,200 LOC across 73 files.

## Critical

1. **Pending state bleeds across sections.** `StoryboardSectionDetail.tsx:703-719` resets `pendingSectioning`/`pendingRendering`/`selectedElement` on page/section change, but never clears `pendingHtmlRef.current`, `hasUnflushedEdits`, or `pendingCategories`. Editing section A then navigating to B writes A's stale HTML into B on the next flush.
2. **Race between `discardAll` and class-change flush.** `discardAll` (`StoryboardSectionDetail.tsx:810`) clears refs and calls `resetContent()`, but `handleClassesChange` (`:1304-1316`) re-populates `pendingHtmlRef` synchronously from iframe callbacks. A debounced edit landing after a discard click silently restores the discarded styles. No generation/abort token.
3. **No origin/source filter on iframe `postMessage`.** `BookPreviewFrame.tsx:243-257` reads `e.data.{dataId,newText,fullHtml}` with no `e.source === iframe.contentWindow` check; iframe sender uses `'*'` (`iframe-interactive.ts:66,90,122,154,168`). Any window can spoof `text-changed` and inject HTML that is later persisted via `api.updateRendering`.
4. **No unsaved-changes guard.** No `beforeunload`, router blocker, or confirm. Navigating away from a section with pending edits silently discards them (compounded by #1 — they may also leak into the next section).
5. **`reconstructHtmlWithEdit` swallows parse errors → MathML persisted.** `iframe-html.ts:11-29` returns `null` on any throw; `BookPreviewFrame.tsx:252-253` falls back to the raw iframe `fullHtml` containing MathML, which then becomes the saved rendering — the exact failure mode the helper was supposed to prevent.

## Likely

6. **Selector injection in changed-element CSS/queries.** `BookPreviewFrame.tsx:388,417,431` interpolate `dataId` directly into `[data-id="…"]` selectors without `CSS.escape` (other call sites in the file *do* escape). A dataId containing `"` or `]` breaks the style rule for the whole batch.
7. **`containerIdCounter` resets each iframe load.** `iframe-interactive.ts:11,44-46` — new `_el1`/`_el2` ids can collide with saved data-ids from a prior session, redirecting reads/writes to a different element.
8. **`refreshCss` not awaited in class-change flow.** `StoryboardSectionDetail.tsx:1310` fires-and-forgets; a quick save can persist HTML before CSS for the new classes is computed.
9. **Selected-element rect goes stale on device-view change.** `BookPreviewFrame.tsx:469-498` remounts the iframe; data-id re-stamping works (`:340-351`) but `selectedElement.rect` is left at the prior viewport.
10. **`promoteFirstHeadingToH1` rewrites server HTML on every inject** (`BookPreviewFrame.tsx:284`), then the rewritten DOM round-trips back into persisted rendering — saved HTML can diverge from server output (h2→h1) on first inspector edit.
11. **BoxInput linked→split loses memory.** `controls/BoxInput.tsx:48-51,66-68` derives `mode` once via `useState` and keeps no per-side cache. Toggle linked off, set per-side, toggle linked on → all four sides clobbered.
12. **Sizing blank → `w-0`.** `class-maps/sizing.ts:50-56` substitutes `"0"` when value is empty, so clearing a width writes `w-0` instead of unsetting/inheriting. UnitInput keyword→px transition (`UnitInput.tsx:91-96`) hits the same path.
13. **`gap-x-`/`gap-y-` collapsed.** `class-maps/layout.ts:106,121` strips both axes but only writes a single `gap-N` — per-axis gap values are lost on any edit in the section.
14. **Per-corner / axis radius collisions.** `class-maps/borders.ts:151-186` shares `t/r/b/l` keys for both single corners and axis pairs; mixed inputs like `rounded-tr-lg rounded-t-sm` collapse to a single value and don't round-trip.
15. **Cascade write redundancy off-by-one.** `use-element-styles.ts:103-123` skips a "redundant" write that equals the inherited value, so the user-perceived "set to inherited value" never records an override at the active breakpoint — next read still cascades, edit appears not to stick.
16. **i18n regressions — translated strings clobbered to literal English.** All in `apps/studio/src/locales/`:
    - `Display`: `es.po:1558` / `fr.po:1559` / `pt-BR.po:1558` (was Visualización / Affichage / Exibição).
    - `Start` (`fr.po:4296`): `Démarrer` → `Début` — wrong if used as a button.
    - `Padding` left untranslated in all three non-English catalogs (`es.po:3220`, `fr.po:3221`, `pt-BR.po:3220`) while `Margin` is translated — inconsistent.

## Possible

17. **Missing deps in effects.** `StoryboardSectionDetail.tsx:651-653` omits `onGeneratingChange`; `:675-685` rotator deps `[aiLoading]` ignore the new `aiMessages` array.
18. **Fake empty DOMRect on deselect** (`BookPreviewFrame.tsx:255`) — any consumer reading `rect.width` on deselect gets `undefined`.
19. **Tailwind keywords missing from `NAME_BY_HEX`.** `tailwind-palette.ts:413-420` populates families only; `white`/`black`/`transparent` are never recognized as palette matches → ColorPicker opens "custom" tab for `#ffffff`/`#000000` and Variables panel can't highlight the active swatch.
20. **Color HSV mid-drag not committed on tab switch** (`color-picker.tsx:213-227`) — `commit` only on pointerup; switching tabs mid-edit loses the in-progress hex.
21. **Unused dep.** `apps/studio/package.json:20` adds `@radix-ui/react-accordion` but nothing imports it (the wrapper was deleted on this branch). Violates principle #5 (minimize dependencies).
22. **`Advanced` textarea reformat reverts.** `sections/Advanced.tsx:21-25` no-ops on same set, so whitespace-only edits flip back on next prop sync — minor UX surprise.

## Verified-clean

- Desktop-first prompt migration (`prompts/activity_*`, `visual_review*`, `web_generation_html*`) is internally consistent vs `SCREENSHOT_VIEWPORTS` in `packages/pipeline/src/screenshot.ts:30-33`.
- No dangling imports of deleted `RawClassChips` / `tailwind-class-registry` / old `SectionEditToolbar`.
- `globals.css` additions are class-scoped, no element-selector leakage.
- `input.tsx` / `tooltip.tsx` changes are backward-compatible additions.

## Suggested fix priority

- **Block merge:** #1–#5 (data integrity / security).
- **Fix before merge:** #6–#15 (correctness in the new editor's core workflows) and #16 (visible UI regression in 3 locales).
- **Cleanup:** #17–#22.
