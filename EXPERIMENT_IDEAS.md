# Experimental UI/UX Ideas — Pipeline Redesign

Ideas being tested in `eliezir/test-pipeline-redesign` for team review.

---

## 1. Icon-only sidebar rail
Replace the full-width text sidebar with a compact icon-only rail with tooltips. Stages grouped by category (Core, Build, Enhance, Output) with visual separators.

## 2. Secondary settings panel
Slide-out panel from the sidebar rail for Pages list and Settings tabs, keeping the main content area uncluttered.

## 3. Full-width top bar
Stage header spans the full width above the content area (not inside the sidebar). Uses React portals so each stage view controls its own header content.

## 4. Device picker for Preview & Storyboard
Desktop/Tablet/Mobile viewport toggle rendered in the top bar. Custom pill selector with white active state on dark background. Preview iframe scales via CSS transform to simulate device widths (1280/768/375).

## 5. Skip book landing page
Remove the step-cards grid landing page (`/books/$label/book`). Redirect straight to Extract (`/books/$label/extract`) on navigation.

## 6. Pipeline onboarding carousel
Wizard-style stepper dialog shown on first visit per book. 4 slides explaining the pipeline:
- Welcome (rocket icon)
- Core path: Extract → Storyboard → Export (mandatory flow)
- Enhancements: 7 optional stages in a grid (Quizzes, Captions, Glossary, ToC, Translate, Speech, Sign Language)
- Preview & Export: Validation, Preview, Export

Uses the same design language as the Book Creation Wizard (step dots, counter, two-column footer, slide animations). Persisted in localStorage so it only shows once per book.
