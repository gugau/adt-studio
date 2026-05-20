/**
 * @module activities/custom
 * @description
 * Escape-hatch handler for agent-authored activities that aren't in the
 * templated set (crossword, drag-and-drop variants, word search, etc.).
 *
 * The section's own embedded <script> implements the interaction. This module
 * re-executes those scripts (since scripts inserted via innerHTML are inert)
 * and exposes a registration API the script calls so we can wire validate /
 * reset into the page's existing Submit/Reset chrome.
 *
 * Registration contract:
 *
 *   <script>
 *     window.adtRegisterCustomActivity(currentSection, {
 *       validate: () => boolean | Promise<boolean>,
 *       reset:    () => void,
 *     });
 *   </script>
 *
 * `currentSection` is exposed as a global (`window.__adtCurrentCustomSection`)
 * during setup so the script can find the section it's inside without having
 * to walk the DOM. Each section gets its own registration; we key the
 * registrations by sectionId so multiple custom activities on one page don't
 * stomp each other.
 */

import { playActivitySound } from '../audio.js';

const registrations = new Map(); // sectionId -> { validate, reset }

/**
 * Re-execute the inline <script> tags inside a section. Browsers don't run
 * scripts that arrived via innerHTML; clone + replace promotes them so they
 * execute exactly once when the section mounts.
 */
const runInlineScripts = (section) => {
    const scripts = section.querySelectorAll('script');
    scripts.forEach((original) => {
        // Skip scripts we've already replaced this round.
        if (original.dataset.adtCustomActivated === 'true') return;
        // Defensive: skip scripts that have somehow lost their parent before
        // we got to them.
        if (!original.parentNode) return;

        const clone = document.createElement('script');
        // Copy attributes — except `src`, which we deliberately do not support
        // (custom activities ship inline behavior so we can vet what's there).
        for (const attr of original.attributes) {
            if (attr.name.toLowerCase() === 'src') continue;
            clone.setAttribute(attr.name, attr.value);
        }
        clone.textContent = original.textContent ?? '';
        clone.dataset.adtCustomActivated = 'true';

        try {
            original.parentNode.replaceChild(clone, original);
        } catch (err) {
            console.error('Custom activity: failed to mount inline script', err);
        }
    });
};

/** Resolve a stable id for a section. Falls back to a per-mount uuid. */
const sectionKey = (section) => {
    if (section.dataset.adtSectionKey) return section.dataset.adtSectionKey;
    const id = section.getAttribute('data-id') || crypto.randomUUID();
    section.dataset.adtSectionKey = id;
    return id;
};

/**
 * Setup entry point — wired into activity.js for sections whose
 * data-section-type is "activity_custom" or "activity_custom_*".
 *
 * Sequence:
 *   1. Mark the section as the current custom-activity scope.
 *   2. Expose window.adtRegisterCustomActivity for the embedded script to call.
 *   3. Re-execute inline scripts inside the section.
 *   4. The script registers its validate/reset functions.
 *   5. We stash them in `registrations` keyed by section id.
 *
 * If the script doesn't register anything, the activity is effectively
 * display-only — Submit will surface that to the user via the validator.
 */
export const prepareCustomActivity = (section) => {
    const key = sectionKey(section);

    // Tell the script where it lives, in case its querySelector logic prefers
    // a known anchor over walking up from `document.currentScript`.
    window.__adtCurrentCustomSection = section;

    // Each call replaces any prior registration for this section. The script
    // is responsible for being idempotent if it gets re-invoked (e.g. on a
    // re-render).
    window.adtRegisterCustomActivity = (sectionEl, handlers) => {
        const targetKey = sectionEl ? sectionKey(sectionEl) : key;
        registrations.set(targetKey, {
            validate: typeof handlers?.validate === 'function' ? handlers.validate : null,
            reset: typeof handlers?.reset === 'function' ? handlers.reset : null,
        });
    };

    runInlineScripts(section);

    // Clean up the global pointer so it doesn't leak between sections.
    window.__adtCurrentCustomSection = null;

    // If the inline script (or scripts) didn't register a validator, the
    // Submit button will appear wired but do nothing. That's a useless failure
    // mode for the author. Surface it with a clear console message AND an
    // in-DOM warning banner so the user sees the gap immediately rather than
    // discovering it on Submit.
    const reg = registrations.get(key);
    if (!reg || !reg.validate) {
        console.warn(
            `Custom activity at section ${key} did not register a validator. ` +
                `The embedded <script> must call window.adtRegisterCustomActivity(section, { validate, reset }).`,
        );
        renderMissingValidatorBanner(section);
    } else {
        // Clear a previously-rendered banner if a script now registered.
        const stale = section.querySelector('.adt-custom-missing-validator');
        if (stale) stale.remove();
    }
};

const renderMissingValidatorBanner = (section) => {
    // Idempotent: don't pile multiple banners on re-mount.
    if (section.querySelector('.adt-custom-missing-validator')) return;
    const banner = document.createElement('div');
    banner.className =
        'adt-custom-missing-validator mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900';
    banner.setAttribute('role', 'alert');
    banner.textContent =
        'This custom activity has no validation logic. The embedded <script> must call window.adtRegisterCustomActivity(section, { validate, reset }). Submit will not grade the answers.';
    section.appendChild(banner);
};

/**
 * Validation entry point — called when the learner clicks Submit on a custom
 * activity. Dispatches to the registered validate() and plays the appropriate
 * feedback sound. The registered function is responsible for any visual
 * feedback inside the section (marking correct/incorrect items, showing
 * messages, etc.).
 */
export const checkCustomActivity = async () => {
    const section = document.querySelector(
        'section[data-section-type="activity_custom"], section[data-section-type^="activity_custom_"]',
    );
    if (!section) {
        console.error('Custom activity section not found');
        return;
    }
    const key = sectionKey(section);
    const reg = registrations.get(key);
    if (!reg || !reg.validate) {
        playActivitySound('error');
        console.warn(
            'Custom activity has no validate handler — the embedded script must call window.adtRegisterCustomActivity(section, { validate, reset }).',
        );
        renderMissingValidatorBanner(section);
        return;
    }
    try {
        const result = await Promise.resolve(reg.validate());
        playActivitySound(result ? 'success' : 'error');
    } catch (err) {
        console.error('Custom activity validate threw:', err);
        playActivitySound('error');
    }
};

/**
 * Reset entry point — called when the learner clicks Reset. Dispatches to the
 * registered reset(). If nothing was registered, we do nothing visually (no
 * harm; the section just stays as-is) — but we clear localStorage keys keyed
 * by the activityId since the runtime tracks attempt counts that way.
 */
export const resetCustomActivity = (activityId) => {
    const section = document.querySelector(
        'section[data-section-type="activity_custom"], section[data-section-type^="activity_custom_"]',
    );
    if (section) {
        const key = sectionKey(section);
        const reg = registrations.get(key);
        if (reg && reg.reset) {
            try {
                reg.reset();
            } catch (err) {
                console.error('Custom activity reset threw:', err);
            }
        }
    }

    // Mirror the cleanup other activity types do: drop any localStorage that
    // the embedded script may have written keyed by the activity id.
    Object.keys(localStorage)
        .filter((k) => k.startsWith(`${activityId}_`))
        .forEach((k) => localStorage.removeItem(k));
};
