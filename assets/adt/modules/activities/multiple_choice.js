import { state, setState } from '../state.js';
import { playActivitySound } from '../audio.js';
import { updateSubmitButtonAndToast, ActivityTypes } from '../utils.js';
import { translateText } from '../translations.js';
import { executeMail } from './send-email.js';
import { updateResetButtonVisibility } from '../../activity.js';
import { isTypingTarget } from './shortcut-utils.js';

let multipleChoiceShortcutHandler = null;

// --- Per-group selection tracking ---
// Maps radio name → selected .activity-option element
const selectedByGroup = new Map();

// --- Color classes toggled by state (never touch structural/layout classes) ---
const CIRCLE_BORDER_NEUTRALS = [
    'border-gray-300', 'border-gray-400',
    'border-stone-300', 'border-stone-400',
    'border-neutral-300', 'border-slate-300',
];
const CIRCLE_BORDER_STATES = ['border-blue-500', 'border-green-500', 'border-red-500'];
const CIRCLE_BGS   = ['bg-white', 'bg-blue-500', 'bg-green-500', 'bg-red-500'];
const CIRCLE_TEXTS  = ['text-gray-500', 'text-white'];

const ALL_CIRCLE_COLORS = [...CIRCLE_BORDER_NEUTRALS, ...CIRCLE_BORDER_STATES, ...CIRCLE_BGS, ...CIRCLE_TEXTS];

const OPTION_RINGS = ['ring-2', 'ring-blue-500', 'ring-green-500', 'ring-red-500'];
const OPTION_BGS   = ['bg-green-50', 'bg-red-50'];

/**
 * Find the radio-circle element inside an option.
 */
const findCircle = (option) => {
    const byClass = option.querySelector('.option-letter');
    if (byClass) return byClass;

    const candidates = option.querySelectorAll('.rounded-full');
    for (const el of candidates) {
        if (el.closest('.feedback-container')) continue;
        if (el.tagName === 'INPUT') continue;
        if (el.classList.contains('border-2') || el.classList.contains('border')) {
            return el;
        }
    }
    return null;
};

/**
 * Non-destructive state setter: only toggles color classes on the radio circle
 * element and ring/bg classes on the label. Structural classes are never touched.
 */
const setOptionState = (option, stateName) => {
    const circleEl = findCircle(option);
    if (circleEl && !isLetterHidden(option)) {
        circleEl.classList.remove(...ALL_CIRCLE_COLORS);

        if (stateName === 'selected') {
            circleEl.classList.add('border-blue-500', 'bg-blue-500', 'text-white');
        } else if (stateName === 'correct') {
            circleEl.classList.add('border-green-500', 'bg-green-500', 'text-white');
        } else if (stateName === 'incorrect') {
            circleEl.classList.add('border-red-500', 'bg-red-500', 'text-white');
        } else {
            circleEl.classList.add('border-gray-300', 'bg-white', 'text-gray-500');
        }
    }

    option.classList.remove(...OPTION_RINGS, ...OPTION_BGS, 'selected-option');

    if (stateName === 'selected') {
        option.classList.add('ring-2', 'ring-blue-500', 'selected-option');
    } else if (stateName === 'correct') {
        option.classList.add('ring-2', 'ring-green-500', 'bg-green-50');
    } else if (stateName === 'incorrect') {
        option.classList.add('ring-2', 'ring-red-500', 'bg-red-50');
    }
};

/**
 * Get the radio group name for an option element.
 */
const getGroupName = (option) => {
    const input = option.querySelector('input[type="radio"]');
    return input?.getAttribute('name') || 'default';
};

/**
 * Get all distinct radio group names within a section.
 */
const getGroupNames = (section) => {
    const names = new Set();
    section.querySelectorAll('.activity-option input[type="radio"]').forEach(input => {
        const name = input.getAttribute('name');
        if (name) names.add(name);
    });
    return names;
};

/**
 * Get all .activity-option elements that belong to a specific radio group name.
 */
const getOptionsForGroup = (groupName) => {
    return [...document.querySelectorAll('.activity-option')].filter(opt => getGroupName(opt) === groupName);
};

const restoreSubmitButtonToValidate = () => {
    const submitButton = document.getElementById("submit-button");
    if (!submitButton || submitButton.dataset.submitState !== 'retry') {
        return;
    }

    submitButton.textContent = translateText("submit-text");
    submitButton.setAttribute("aria-label", translateText("submit-text"));
    submitButton.dataset.submitState = 'submit';

    if (state.retryHandler) {
        submitButton.removeEventListener("click", state.retryHandler);
        state.retryHandler = null;
    }

    if (state.validateHandler) {
        submitButton.removeEventListener("click", state.validateHandler);
        submitButton.addEventListener("click", state.validateHandler);
    }
};

export const prepareMultipleChoice = (section) => {
    // Clear stale group selections from previous pages
    selectedByGroup.clear();

    // Self-healing: if the LLM didn't add .activity-option to labels containing
    // radio inputs, find them and tag them so the rest of the JS works.
    if (!section.querySelector('.activity-option')) {
        section.querySelectorAll('label').forEach((label) => {
            if (label.querySelector('input[type="radio"]')) {
                label.classList.add('activity-option');
            }
        });
    }

    const activityOptions = section.querySelectorAll(".activity-option");

    // Remove any previous event listeners by cloning nodes.
    // This must happen BEFORE restorePreviousSelection so that restored
    // references in selectedByGroup point to the live DOM nodes.
    activityOptions.forEach((option) => {
        const newOption = option.cloneNode(true);
        option.parentNode.replaceChild(newOption, option);
    });

    restorePreviousSelection(section);

    // Add new event listeners
    section.querySelectorAll(".activity-option").forEach((option) => {
        option.addEventListener("click", () => selectOption(option));

        option.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectOption(option);
            }
        });

        const optionLetter = option.querySelector('.option-letter')?.textContent || '';
        const imgAlt = option.querySelector('img')?.alt || '';
        const shadowInput = option.querySelector('input[type="radio"]');
        if (shadowInput) {
            shadowInput.setAttribute('tabindex', '-1');
        }

        option.setAttribute('aria-label', `Option ${optionLetter}: ${imgAlt}`);
        option.setAttribute('role', 'radio');
        option.setAttribute('aria-checked', 'false');

        option.classList.add(
            'cursor-pointer',
            'transition-shadow',
            'duration-200',
            'hover:shadow-md',
            'focus:outline-none',
            'focus:ring-2',
            'focus:ring-blue-500',
            'focus:ring-opacity-50',
            'rounded-lg'
        );
    });

    // Set proper radiogroup role on containers.
    // For multi-group pages, each group's parent should be a radiogroup.
    const groupNames = getGroupNames(section);
    if (groupNames.size <= 1) {
        // Single group — use existing logic
        let radioGroup = section.querySelector('[role="group"]') || section.querySelector('[role="radiogroup"]');
        if (!radioGroup) {
            const firstOption = section.querySelector('.activity-option');
            if (firstOption) {
                radioGroup = firstOption.parentElement;
            }
        }
        if (radioGroup) {
            radioGroup.setAttribute('role', 'radiogroup');
            radioGroup.setAttribute('aria-labelledby', 'question-label');
        }
    } else {
        // Multiple groups — tag each group's parent as a radiogroup
        for (const name of groupNames) {
            const groupOptions = getOptionsForGroup(name);
            if (groupOptions.length > 0) {
                const parent = groupOptions[0].parentElement;
                if (parent && !parent.getAttribute('role')) {
                    parent.setAttribute('role', 'radiogroup');
                }
            }
        }
    }

    // Shortcut hint
    const radioGroup = section.querySelector('[role="radiogroup"]');
    if (radioGroup) {
        let shortcutHint = radioGroup.querySelector('.quiz-shortcut-hint');
        if (!shortcutHint) {
            shortcutHint = document.createElement('p');
            shortcutHint.className = 'quiz-shortcut-hint sr-only';
            shortcutHint.setAttribute('aria-live', 'polite');
            radioGroup.prepend(shortcutHint);
        }
        shortcutHint.textContent = translateText('quiz-shortcut-hint');
    }

    // Always clean up previous keyboard handler before potentially adding a new one
    if (multipleChoiceShortcutHandler) {
        document.removeEventListener("keydown", multipleChoiceShortcutHandler);
        multipleChoiceShortcutHandler = null;
    }

    // Keyboard shortcuts — only for single-group pages (ambiguous for multi-group)
    if (groupNames.size <= 1) {
        const options = [...section.querySelectorAll(".activity-option")];
        const keyHandler = (e) => {
            if (isTypingTarget(e.target)) {
                return;
            }

            const digit = parseInt(e.key, 10);
            if (digit >= 1 && digit <= options.length) {
                e.preventDefault();
                selectOption(options[digit - 1]);
            } else if (e.key === "Enter") {
                const submitButton = document.getElementById("submit-button");
                if (submitButton) {
                    e.preventDefault();
                    submitButton.click();
                }
            }
        };
        multipleChoiceShortcutHandler = keyHandler;
        document.addEventListener("keydown", multipleChoiceShortcutHandler);
    }
};

const saveSelectionState = (option) => {
    const activityId = location.pathname
        .substring(location.pathname.lastIndexOf("/") + 1)
        .split(".")[0];

    const groupName = getGroupName(option);
    const storageKey = `${activityId}_${groupName}_multipleChoice`;

    const selectedData = {
        question: option.getAttribute("data-activity-item"),
        value: option.querySelector('input[type="radio"]').value,
        groupName,
    };

    localStorage.setItem(storageKey, JSON.stringify(selectedData));
};

const restorePreviousSelection = (section) => {
    const activityId = location.pathname
        .substring(location.pathname.lastIndexOf("/") + 1)
        .split(".")[0];

    const groupNames = getGroupNames(section);

    for (const groupName of groupNames) {
        const storageKey = `${activityId}_${groupName}_multipleChoice`;
        const savedSelection = localStorage.getItem(storageKey);

        if (savedSelection) {
            const { value } = JSON.parse(savedSelection);
            const selectedOption = [...section.querySelectorAll(".activity-option")].find(option =>
                option.querySelector('input[type="radio"]')?.value === value
            );

            if (selectedOption) {
                selectClickedOption(selectedOption);
                selectedByGroup.set(groupName, selectedOption);
            }
        }
    }

    // Keep legacy state.selectedOption pointing at the last restored option
    if (selectedByGroup.size > 0) {
        setState('selectedOption', [...selectedByGroup.values()].pop());
    }
};

const isLetterHidden = (option) => {
    const letterElement = option.querySelector('.option-letter');
    const wrapper = letterElement?.parentElement;
    return (
        letterElement?.dataset.letterHidden === 'true' ||
        wrapper?.dataset.letterHidden === 'true'
    );
};

const selectOption = (option) => {
    const groupName = getGroupName(option);

    // Only clear validation styling for THIS group, not all groups
    clearGroupValidationStyling(groupName);

    // Reset only options in the same radio group
    const groupOptions = getOptionsForGroup(groupName);
    groupOptions.forEach(opt => {
        opt.setAttribute('aria-checked', 'false');
        setOptionState(opt, 'default');
    });

    selectClickedOption(option);
    selectedByGroup.set(groupName, option);
    // Keep legacy single-option state for backward compatibility
    setState('selectedOption', option);

    option.setAttribute('aria-checked', 'true');

    // Announce selection to screen readers
    const optionLetter = option.querySelector('.option-letter')?.textContent || '';
    const liveRegion = document.getElementById('validation-results-announcement');
    if (liveRegion) {
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.textContent = `Option ${optionLetter} selected`;
        setTimeout(() => {
            liveRegion.textContent = '';
        }, 1000);
    }

    saveSelectionState(option);
    restoreSubmitButtonToValidate();
};

/**
 * Clear validation styling only for options in a specific radio group.
 */
const clearGroupValidationStyling = (groupName) => {
    const groupOptions = getOptionsForGroup(groupName);
    groupOptions.forEach(option => {
        option.removeAttribute('aria-invalid');
        option.querySelector('.result-mark')?.remove();
        setOptionState(option, 'default');
    });
    // Remove summary banner — score changed, will be recalculated on next submit
    document.querySelector('.mcq-summary-banner')?.remove();
};

/**
 * Clear all validation styling across all groups (used on full reset).
 */
const clearAllValidationStyling = () => {
    document.querySelectorAll(".validation-mark").forEach(mark => {
        mark.classList.add('hidden');
        mark.textContent = '';
    });

    document.querySelectorAll(".activity-option").forEach(option => {
        option.removeAttribute('aria-invalid');
        option.querySelector('.result-mark')?.remove();
        setOptionState(option, 'default');
    });

    // Remove inline summary banner
    document.querySelector('.mcq-summary-banner')?.remove();

    const validationResults = document.getElementById('validation-results-announcement');
    if (validationResults) {
        validationResults.textContent = translateText('selection-changed-resubmit');
    }
};

const selectClickedOption = (option) => {
    const input = option.querySelector('input[type="radio"]');
    if (input) {
        input.checked = true;
    }

    option.setAttribute('aria-checked', 'true');
    setOptionState(option, 'selected');
};

const getActivityItem = (element) => {
    let activityItem = element.getAttribute('data-activity-item');

    if (!activityItem) {
        const input = element.querySelector('input[type="radio"]');
        if (input) {
            activityItem = input.getAttribute('data-activity-item');
        }

        if (element.tagName === 'INPUT') {
            const label = element.closest('.activity-option');
            if (label) {
                activityItem = label.getAttribute('data-activity-item') || activityItem;
            }
        }
    }

    return activityItem;
};

export const checkMultipleChoice = () => {
    // Collect all groups that have a selection
    const section = document.querySelector('[data-section-type="activity_multiple_choice"]');
    const allGroupNames = section ? getGroupNames(section) : new Set();
    const isSingleGroup = allGroupNames.size <= 1;

    if (isSingleGroup) {
        // --- Single group: original behavior ---
        if (!state.selectedOption) {
            const announcement = document.getElementById('validation-results-announcement');
            if (announcement) {
                announcement.setAttribute('aria-live', 'assertive');
                announcement.textContent = translateText("select-option-first");
                setTimeout(() => { announcement.textContent = ''; }, 3000);
            }
            return;
        }

        const dataActivityItem = getActivityItem(state.selectedOption);
        const raw = correctAnswers[dataActivityItem];
        const isCorrect = raw === true || raw === "true";

        styleSelectedOption(state.selectedOption, isCorrect);
        showResultMark(state.selectedOption, isCorrect);
        if (section) {
            showInlineSummary(section, { correct: isCorrect ? 1 : 0, total: 1, allCorrect: isCorrect });
        }
        recordAttemptResult(isCorrect);
        if (typeof updateResetButtonVisibility === 'function') {
            updateResetButtonVisibility();
        }
        updateSubmitButtonAndToast(
            isCorrect,
            translateText("next-activity"),
            ActivityTypes.MULTIPLE_CHOICE
        );
    } else {
        // --- Multi-group: check all groups ---
        // Require at least one selection before allowing submit
        if (selectedByGroup.size === 0) {
            const announcement = document.getElementById('validation-results-announcement');
            if (announcement) {
                announcement.setAttribute('aria-live', 'assertive');
                announcement.textContent = translateText("select-option-first");
                setTimeout(() => { announcement.textContent = ''; }, 3000);
            }
            return;
        }

        // Check each group — answered groups get correct/incorrect feedback,
        // unanswered groups are marked as skipped (incorrect).
        let allCorrect = true;
        let correctCount = 0;
        const totalGroups = allGroupNames.size;

        for (const groupName of allGroupNames) {
            const selectedOption = selectedByGroup.get(groupName);

            if (selectedOption) {
                const dataActivityItem = getActivityItem(selectedOption);
                const raw = correctAnswers[dataActivityItem];
                const isCorrect = raw === true || raw === "true";

                styleSelectedOption(selectedOption, isCorrect);
                showResultMark(selectedOption, isCorrect);

                if (isCorrect) {
                    correctCount++;
                } else {
                    allCorrect = false;
                }
            } else {
                // Unanswered group — highlight the correct option so the student
                // can see what they missed.
                allCorrect = false;
                const groupOptions = getOptionsForGroup(groupName);
                for (const opt of groupOptions) {
                    const itemId = getActivityItem(opt);
                    const raw = correctAnswers[itemId];
                    const isAnswer = raw === true || raw === "true";
                    if (isAnswer) {
                        setOptionState(opt, 'correct');
                        showResultMark(opt, true);
                    }
                }
            }
        }

        if (section) {
            showInlineSummary(section, { correct: correctCount, total: totalGroups, allCorrect });
        }
        recordAttemptResult(allCorrect);
        if (typeof updateResetButtonVisibility === 'function') {
            updateResetButtonVisibility();
        }
        updateSubmitButtonAndToast(
            allCorrect,
            translateText("next-activity"),
            ActivityTypes.MULTIPLE_CHOICE
        );
    }
};

/**
 * Show an inline summary banner at the bottom of the activity section.
 * Replaces the toast popup for better accessibility — persistent, in-context,
 * and announced to screen readers via aria-live.
 */
const showInlineSummary = (section, { correct, total, allCorrect }) => {
    // Remove any existing banner
    section.querySelector('.mcq-summary-banner')?.remove();

    const banner = document.createElement('div');
    banner.className = 'mcq-summary-banner mt-8 rounded-xl px-6 py-4 flex items-center gap-3 shadow-sm';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');

    if (allCorrect) {
        banner.classList.add('bg-green-50', 'border', 'border-green-200');
        banner.innerHTML = `
            <span class="text-2xl" aria-hidden="true">🎉</span>
            <span class="text-green-800 font-semibold text-lg">${translateText('multiple-choice-correct-answer')}</span>
        `;
    } else {
        banner.classList.add('bg-amber-50', 'border', 'border-amber-200');
        const scoreText = total > 1
            ? `${correct} / ${total}`
            : '';
        banner.innerHTML = `
            <span class="text-2xl" aria-hidden="true">🔄</span>
            <div class="flex flex-col">
                ${scoreText ? `<span class="text-amber-900 font-semibold text-lg">${scoreText}</span>` : ''}
                <span class="text-amber-800 text-base">${translateText('multiple-choice-try-again')}</span>
            </div>
        `;
    }

    section.appendChild(banner);

    // Smooth scroll so the banner is visible
    banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

const styleSelectedOption = (option, isCorrect) => {
    setOptionState(option, isCorrect ? 'correct' : 'incorrect');
    option.setAttribute('aria-invalid', isCorrect ? 'false' : 'true');
};

/**
 * Show a ✓ or ✗ result badge overlaid on the option.
 * Works universally regardless of option content (text, images, cards).
 */
const showResultMark = (option, isCorrect) => {
    // Remove any existing mark first
    option.querySelector('.result-mark')?.remove();

    const mark = document.createElement('div');
    mark.className = 'result-mark absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md';
    mark.classList.add(isCorrect ? 'bg-green-500' : 'bg-red-400');
    mark.textContent = isCorrect ? '✓' : '✗';
    mark.setAttribute('aria-label', isCorrect ? 'Correct' : 'Incorrect');

    // Ensure the option is positioned so the badge can be absolutely placed
    if (!['relative', 'absolute', 'fixed', 'sticky'].includes(getComputedStyle(option).position)) {
        option.classList.add('relative');
    }

    option.appendChild(mark);
};

/**
 * Record attempt, play sound, track completion, and send email.
 * Called once per submit regardless of number of groups.
 */
const recordAttemptResult = (isCorrect) => {
    const activityId = location.pathname
        .substring(location.pathname.lastIndexOf("/") + 1)
        .split(".")[0];
    let key = activityId + "-intentos";
    let intentCount = localStorage.getItem(key);
    if (intentCount === null) {
        localStorage.setItem(key, "0");
        intentCount = 0;
    } else {
        intentCount = parseInt(intentCount, 10);
    }

    intentCount++;
    localStorage.setItem(key, intentCount.toString());

    if (isCorrect) {
        playActivitySound('success');

        const storedActivities = localStorage.getItem("completedActivities");
        let completedActivities = storedActivities ? JSON.parse(storedActivities) : [];

        const namePage = localStorage.getItem("namePage");
        const timeDone = new Date().toLocaleString("es-ES");
        const newActivityId = `${activityId}-${namePage}-${intentCount}-${timeDone}`;

        completedActivities = completedActivities.filter(id => !id.startsWith(`${activityId}-`));
        completedActivities.push(newActivityId);
        localStorage.setItem("completedActivities", JSON.stringify(completedActivities));

        localStorage.setItem("namePage", document.querySelector("h1")?.innerText ?? "unknown_page");
        executeMail(ActivityTypes.MULTIPLE_CHOICE);
    } else {
        playActivitySound('error');
    }
};
