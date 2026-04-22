/**
 * @module tts_highlighter
 * @description
 * Provides word-by-word highlighting for TTS audio playback, including subtitle popups for images and glossary integration.
 */
import { state } from "./state.js";
import { stopAudio } from "./audio.js";
import { unhighlightAllElements, unhighlightElement, highlightElement } from './ui_utils.js';
import { showGlossaryDefinition } from './interface.js';
import {
  buildWordRenderPlan,
  getHighlightDisplayText,
  normalizeGlossaryText,
} from "./tts_highlighter_utils.js";

let timecodeData = null;
let monitorInterval = null;
let currentListener = null;
let endedListener = null;
let metadataListener = null;
let attachedAudio = null;
const TOLERANCE = 0.2; // 200ms tolerance

let subtitlePopup = null;
let lastHighlightedImage = null;

/**
 * Loads the timecode JSON for the current language and starts monitoring the current audio for word highlighting.
 * @async
 */
export async function initializeWordByWordHighlighter() {
  const timecodeJsonUrl = `./content/i18n/${state.currentLanguage}/timecode/timecode_output.json`;
  try {
    const response = await fetch(timecodeJsonUrl);
    if (!response.ok) {
      throw new Error(`Failed to load timecode JSON: ${response.statusText}`);
    }
    timecodeData = await response.json();
  } catch (error) {
    timecodeData = {};
    console.warn("Timecodes unavailable, using runtime fallback highlighting.", error);
  }
  startMonitoring();
}

function getStoredWordTimestamps(entry) {
  const timestamps = (entry?.timecodes && entry.timecodes[1] && entry.timecodes[1].word_timestamps) || [];
  return timestamps.filter((timestamp) => normalizeGlossaryText(timestamp?.text).length > 0);
}

/**
 * Starts monitoring the current audio for word highlighting.
 * Sets up a timer to check the audio's currentTime.
 * @private
 */
function startMonitoring() {
  if (monitorInterval) return;
  // Check the audio's currentTime every 50ms for more responsive updates
  monitorInterval = setInterval(checkCurrentAudio, 50);
}

/**
 * Checks the current audio and attaches or detaches the word highlighter as needed.
 * @private
 */
function checkCurrentAudio() {
  const audio = state.currentAudio;
  if (audio && state.wordHighlightMode !== false && !audio._wordHighlighterAttached) {
    attachWordHighlighter(audio);
  } else if ((!audio || state.wordHighlightMode === false) && (currentListener || subtitlePopup)) {
    detachCurrentListener();
    clearHighlights();
    if (subtitlePopup) {
      hideSubtitlePopup();
    }
  }
}

/**
 * Attaches the word highlighter to the current audio element.
 * Handles easy-read mode, glossary terms, and subtitle popups for images.
 * @private
 * @param {HTMLAudioElement} audio - The audio element to attach the highlighter to.
 */
function attachWordHighlighter(audio) {
  // Get the current text element (from state.audioElements and state.currentIndex).
  const audioElements = state.audioElements;
  if (!audioElements || audioElements.length === 0) return;
  const currentIndex = state.currentIndex;
  if (currentIndex < 0 || currentIndex >= audioElements.length) return;
  const { element, id: dataId } = audioElements[currentIndex];

  // Get the translation key with proper easy-read handling
  let translationKey = dataId;
  let timecodeKey = dataId;

  if (state.easyReadMode) {
    // Check if element is a header
    const isHeader = element.tagName.toLowerCase().match(/^h[1-6]$/);

    // Check if element is inside excluded areas
    const wordCard = element.closest('.word-card');
    const activityItem = element.closest('[data-activity-item]');
    const navList = element.closest('.nav__list');
    const activityText = element.closest('.activity-text');
    const isExcluded = wordCard !== null || activityItem !== null ||
      navList !== null || activityText !== null;

    // Use easyread translation if not a header and not in excluded areas
    if (!isHeader && !isExcluded) {
      const easyReadKey = `easyread-${dataId}`;
      if (state.translations && state.translations.hasOwnProperty(easyReadKey)) {
        translationKey = easyReadKey;

        // FALLBACK MECHANISM: Try to use easyReadKey for timecode first
        // If that doesn't exist in timecodeData, fall back to original dataId
        timecodeKey = (timecodeData && timecodeData[easyReadKey]) ? easyReadKey : dataId;
      }
    }
  }

  const translatedText = state.translations && state.translations[translationKey]
    ? state.translations[translationKey]
    : element.textContent;
  const entry = timecodeData && timecodeData[timecodeKey] ? timecodeData[timecodeKey] : null;
  const storedWordTimestamps = getStoredWordTimestamps(entry);

  // Fall back to block (blue-box) highlight when timecodes are missing — more
  // reliable than evenly-divided approximate timings that can drift from the
  // actual word boundaries.
  if (storedWordTimestamps.length === 0) {
    const isImage = element.tagName.toLowerCase() === 'img';
    if (!isImage) {
      highlightElement(element);
    }
    // Mark as attached so the 50ms poll doesn't re-enter every tick.
    // processAudioQueue's unhighlightElement after playback will clear the block highlight.
    audio._wordHighlighterAttached = true;
    attachedAudio = audio;
    return;
  }

  const wordTimestamps = storedWordTimestamps;

  // Check if this is an image element - if so, create a subtitle popup
  const isImage = element.tagName.toLowerCase() === 'img';
  if (isImage) {
    createSubtitlePopup(element, translatedText);
    lastHighlightedImage = element;
  } else {
    // If we're not highlighting an image, hide any existing subtitle popup
    if (subtitlePopup) {
      hideSubtitlePopup();
    }
  }

  // Get the target element for highlighting (either the original element or the subtitle popup content)
  const targetElement = isImage ? subtitlePopup.querySelector('.subtitle-content') : element;

  // Once word timings are available, drop the coarse block highlight so only
  // the active word is emphasized.
  unhighlightElement(element);

  // Wrap the text in spans (if not already wrapped).
  if (!targetElement.dataset.wordsWrapped) {
    wrapTextInSpans(targetElement, wordTimestamps, translatedText);
    targetElement.dataset.wordsWrapped = "true";
  }

  // Clear highlights on other text elements.
  document.querySelectorAll('[data-words-wrapped="true"]').forEach(el => {
    if (el !== targetElement) {
      el.querySelectorAll("span[data-word-index]").forEach(span => {
        span.classList.remove("bg-yellow-300");
        span.classList.remove("rounded-lg");
        span.classList.remove("text-black");
      });
    }
  });

  // Highlight the first word when we start
  const firstSpan = targetElement.querySelector('span[data-word-index="0"]');
  if (firstSpan) {
    targetElement.querySelectorAll("span[data-word-index]").forEach(span => {
      span.classList.remove("bg-yellow-300");
      span.classList.remove("rounded-lg");
      span.classList.remove("text-black");
    });
    firstSpan.classList.add("bg-yellow-300");
    firstSpan.classList.add("rounded-lg");
    firstSpan.classList.add("text-black");
  }

  // Detach any existing listeners first to avoid duplicates
  detachCurrentListener();

  // Attach a timeupdate listener
  currentListener = () => updateWordHighlighting(audio, targetElement, wordTimestamps);
  audio.addEventListener("timeupdate", currentListener);

  // Add an ended listener to clear highlights when audio finishes
  endedListener = () => {
    clearHighlights();
    if (isImage && subtitlePopup) {
      hideSubtitlePopup();
    }
  };
  audio.addEventListener("ended", endedListener);

  // Also listen for play event to ensure first word gets highlighted
  audio.addEventListener("play", () => {
    const firstSpan = targetElement.querySelector('span[data-word-index="0"]');
    if (firstSpan && audio.currentTime < wordTimestamps[0].end + TOLERANCE) {
      targetElement.querySelectorAll("span[data-word-index]").forEach(span => {
        span.classList.remove("bg-yellow-300");
        span.classList.remove("rounded-lg");
        span.classList.remove("text-black");
      });
      firstSpan.classList.add("bg-yellow-300");
      firstSpan.classList.add("rounded-lg");
      firstSpan.classList.add("text-black");
    }
  });

  // Listen for index changes to clear highlights when moving to next item
  document.addEventListener("audioIndexChanged", clearHighlights);

  audio._wordHighlighterAttached = true;
  attachedAudio = audio;
}

/**
 * Creates a subtitle popup below an image element and displays the provided text.
 * @private
 * @param {HTMLElement} imageElement - The image element to anchor the popup to.
 * @param {string} text - The subtitle text to display.
 * @returns {HTMLElement} The created subtitle popup element.
 */
function createSubtitlePopup(imageElement, text) {

  // Remove any click outside listeners before hiding existing popup
  document.removeEventListener('click', handleClickOutside);

  // Hide any existing popup first
  if (subtitlePopup) {
    // Skip fade-out animation when directly replacing with a new popup
    if (subtitlePopup.parentNode) {
      subtitlePopup.parentNode.removeChild(subtitlePopup);
      subtitlePopup = null;
    }
  }

  // Create the popup
  subtitlePopup = document.createElement('div');
  subtitlePopup.className = 'fixed z-50 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-300 shadow-lg p-3 max-w-md min-w-[280px] opacity-0 transition-opacity duration-300 ease-in-out';
  subtitlePopup.style.width = Math.min(Math.max(imageElement.offsetWidth * 1.2, 280), 500) + 'px';

  // Add content div that will hold the text with word-by-word highlighting
  const content = document.createElement('div');
  content.className = 'subtitle-content text-lg leading-relaxed';
  content.textContent = text;

  subtitlePopup.appendChild(content);
  document.body.appendChild(subtitlePopup);

  // Position it below the image
  positionSubtitlePopup(imageElement);

  // Add visible class for fade-in
  setTimeout(() => {
    subtitlePopup.classList.add('opacity-100');
  }, 10);

  // Add a listener to reposition on window resize
  window.addEventListener('resize', () => {
    if (subtitlePopup && lastHighlightedImage) {
      positionSubtitlePopup(lastHighlightedImage);
    }
  });

  // Add click outside listener
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside);
  }, 50);

  return subtitlePopup;
}

/**
 * Handles clicks outside the subtitle popup to hide it.
 * @private
 * @param {MouseEvent} event
 */
function handleClickOutside(event) {
  // Check if we have a popup and if the click was outside both the popup and the currently highlighted image
  if (subtitlePopup &&
    !subtitlePopup.contains(event.target) &&
    (!lastHighlightedImage || !lastHighlightedImage.contains(event.target))) {

    // If we're clicking on a different image, don't hide the popup yet
    // The createSubtitlePopup for that new image will handle it
    if (event.target.tagName.toLowerCase() === 'img' &&
      event.target.getAttribute('data-id')) {
      return;
    }

    hideSubtitlePopup();
  }
}

/**
 * Positions the subtitle popup below the given image element.
 * @private
 * @param {HTMLElement} imageElement
 */
function positionSubtitlePopup(imageElement) {
  if (!subtitlePopup) return;

  const rect = imageElement.getBoundingClientRect();

  // Position it centered below the image
  subtitlePopup.style.top = (rect.bottom + window.scrollY + 8) + 'px';
  subtitlePopup.style.left = (rect.left + window.scrollX + (rect.width - subtitlePopup.offsetWidth) / 2) + 'px';

  // Make sure it's not off-screen
  const viewportWidth = window.innerWidth;
  const popupRect = subtitlePopup.getBoundingClientRect();

  if (popupRect.right > viewportWidth) {
    subtitlePopup.style.left = (viewportWidth - popupRect.width - 8) + 'px';
  }

  if (parseFloat(subtitlePopup.style.left) < 8) {
    subtitlePopup.style.left = '8px';
  }
}

/**
 * Hides and removes the subtitle popup from the DOM.
 * @private
 */
function hideSubtitlePopup() {
  if (subtitlePopup) {
    // Remove click outside listener
    document.removeEventListener('click', handleClickOutside);

    // Fade out
    subtitlePopup.classList.add('opacity-0');

    // Remove after animation
    setTimeout(() => {
      if (subtitlePopup && subtitlePopup.parentNode) {
        subtitlePopup.parentNode.removeChild(subtitlePopup);
        subtitlePopup = null;
      }
    }, 300);
  }
  lastHighlightedImage = null;
}

/**
 * Removes all word highlights and cleans up subtitle popups.
 * @private
 */
function clearHighlights() {
  // Remove the Tailwind highlight class from all wrapped elements.
  const wrappedElements = document.querySelectorAll('[data-words-wrapped="true"]');
  wrappedElements.forEach(element => {
    element.querySelectorAll("span[data-word-index]").forEach(span => {
      span.classList.remove("bg-yellow-300");
      span.classList.remove("rounded-lg");
      span.classList.remove("text-black");
    });
  });
}

/**
 * Detaches the current audio event listeners for word highlighting.
 * @private
 */
function detachCurrentListener() {
  const audio = attachedAudio || state.currentAudio;
  if (audio && currentListener) {
      audio.removeEventListener("timeupdate", currentListener);
  }
  if (audio && endedListener) {
      audio.removeEventListener("ended", endedListener);
  }
  if (audio && metadataListener) {
      audio.removeEventListener("loadedmetadata", metadataListener);
  }
  currentListener = null;
  endedListener = null;
  metadataListener = null;

  if (audio) {
    audio._wordHighlighterAttached = false;
  }
  attachedAudio = null;

  // Remove the index change listener
  document.removeEventListener("audioIndexChanged", clearHighlights);
}

function createWordSpan(documentRef, wordIndex, text, termAttr = null) {
  const span = documentRef.createElement("span");
  span.setAttribute("data-word-index", String(wordIndex));
  span.textContent = text;

  if (termAttr) {
    span.className = termAttr.classes.join(" ");
    span.setAttribute("role", termAttr.role || "button");
    span.setAttribute("tabindex", termAttr.tabindex || "0");
    span.setAttribute("data-glossary-term", "true");
  }

  return span;
}

function renderAlignedWordNodes(documentRef, renderPlan, modifiedTimestamps, glossaryMapping) {
  const fragment = documentRef.createDocumentFragment();
  let segmentIndex = 0;

  while (segmentIndex < renderPlan.length) {
    const segment = renderPlan[segmentIndex];
    if (segment.type === "separator") {
      fragment.appendChild(documentRef.createTextNode(segment.text));
      segmentIndex += 1;
      continue;
    }

    const ts = modifiedTimestamps[segment.wordIndex];
    if (!ts) {
      fragment.appendChild(documentRef.createTextNode(segment.text));
      segmentIndex += 1;
      continue;
    }

    if (ts.isPartOfGlossaryTerm && ts.glossaryTermIndex === segment.wordIndex) {
      const endWordIndex = segment.wordIndex + ts.glossaryTermLength - 1;
      let termText = "";

      while (segmentIndex < renderPlan.length) {
        const nextSegment = renderPlan[segmentIndex];
        termText += nextSegment.text;
        segmentIndex += 1;

        if (nextSegment.type === "word" && nextSegment.wordIndex === endWordIndex) {
          break;
        }
      }

      fragment.appendChild(
        createWordSpan(documentRef, ts.glossaryTermIndex, termText, glossaryMapping[ts.glossaryTerm]),
      );
      continue;
    }

    if (!ts.isPartOfGlossaryTerm) {
      const glossaryEntry = glossaryMapping[ts.normalizedText] || null;
      fragment.appendChild(
        createWordSpan(documentRef, segment.wordIndex, segment.text, glossaryEntry),
      );
    }

    segmentIndex += 1;
  }

  return fragment;
}

/**
 * Wraps the text content of an element in <span> tags for each word, handling glossary terms.
 * Adds click listeners for glossary terms.
 * @private
 * @param {HTMLElement} element - The element whose text to wrap.
 * @param {Array} wordTimestamps - Array of word timestamp objects.
 * @param {string} translatedText - The text to use for wrapping.
 */
function wrapTextInSpans(element, wordTimestamps, translatedText) {
  const glossaryMapping = {};
  const glossaryElements = element.querySelectorAll('.glossary-term');

  // Preserve the text already rendered in the DOM so playback does not
  // rewrite punctuation or spacing from a catalog entry that differs slightly.
  const originalText = getHighlightDisplayText(element, translatedText);

  // Build a map of all glossary terms
  glossaryElements.forEach(termElement => {
    const termText = termElement.textContent.trim();
    const normalizedText = normalizeGlossaryText(termText);
    if (!normalizedText) return;

    glossaryMapping[normalizedText] = {
      classes: Array.from(termElement.classList),
      role: termElement.getAttribute('role'),
      tabindex: termElement.getAttribute('tabindex'),
    };
  });

  const renderPlan = buildWordRenderPlan(originalText);
  const renderWords = renderPlan.filter(segment => segment.type === "word");

  // Create a working copy of timestamps that we can modify
  const modifiedTimestamps = wordTimestamps.map((timestamp, index) => ({
    ...timestamp,
    displayText: renderWords?.[index]?.text || timestamp.text,
    normalizedText: renderWords?.[index]?.normalizedText || normalizeGlossaryText(timestamp.text),
  }));

  // Step 1: Sort glossary terms by length (longest first) to handle overlapping terms
  // This ensures "bosque tropical" is processed before "bosque"
  const sortedGlossaryTerms = Object.keys(glossaryMapping)
    .sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length);

  // Step 2: Look for multi-word glossary terms and mark them
  sortedGlossaryTerms.forEach(term => {
    const words = term.split(/\s+/);

    // Find potential matches in our timestamps
    for (let i = 0; i < modifiedTimestamps.length - words.length + 1; i++) {
      // Skip if this position is already part of a glossary term
      if (modifiedTimestamps[i].isPartOfGlossaryTerm) continue;

      // Get the sequence of words at this position and normalize for comparison
      const sequence = modifiedTimestamps.slice(i, i + words.length)
        .map(ts => ts.normalizedText)
        .join(' ');

      // If we found a match
      if (sequence === term) {
        // Flag each word in this sequence as part of a glossary term
        for (let j = 0; j < words.length; j++) {
          modifiedTimestamps[i + j].isPartOfGlossaryTerm = true;
          modifiedTimestamps[i + j].glossaryTermIndex = i;
          modifiedTimestamps[i + j].glossaryTermLength = words.length;
          modifiedTimestamps[i + j].glossaryTerm = term;
        }
      }
    }
  });

  // Step 3: Render word spans while preserving the original punctuation and spacing.
  const fragment = renderAlignedWordNodes(
    element.ownerDocument,
    renderPlan,
    modifiedTimestamps,
    glossaryMapping,
  );

  element.textContent = "";
  element.appendChild(fragment);

  // Add event parameter to the click handler
  element.querySelectorAll('[data-glossary-term="true"]').forEach(term => {
    term.addEventListener('click', (event) => {  // Note the event parameter here
      // Stop event propagation to prevent parent elements from receiving the click
      event.stopPropagation();
      // event.preventDefault();

      // Set a flag to prevent audio playback
      window._isGlossaryTermClick = true;

      // Stop any currently playing audio
      if (state.isPlaying || state.currentAudio) {
        stopAudio();
        unhighlightAllElements();
      }

      // Show the glossary definition popup
      showGlossaryDefinition(event);

      // Clear the flag after a short delay
      setTimeout(() => {
        window._isGlossaryTermClick = false;
      }, 100);
    });
  });
}

/**
 * Updates the highlighted word based on the current audio time.
 * @private
 * @param {HTMLAudioElement} audio - The audio element.
 * @param {HTMLElement} element - The element containing the word spans.
 * @param {Array} wordTimestamps - Array of word timestamp objects.
 */
function updateWordHighlighting(audio, element, wordTimestamps) {
  const currentTime = audio.currentTime;
  let activeIndex = -1;

  // Check if we're past the last word's end time
  const lastWord = wordTimestamps[wordTimestamps.length - 1];
  if (lastWord && currentTime > lastWord.end + TOLERANCE) {
    // We're past the last word, clear all highlights
    clearHighlights();
    return;
  }

  // Special case for before the first word
  if (currentTime < wordTimestamps[0].start) {
    activeIndex = 0;
  }
  // Special case for after the last word but still within tolerance
  else if (currentTime >= wordTimestamps[wordTimestamps.length - 1].start) {
    activeIndex = wordTimestamps.length - 1;
  }
  // Find the right word based on position between start times
  else {
    // Find the last word whose start time is before or equal to the current time
    for (let i = 0; i < wordTimestamps.length; i++) {
      if (currentTime >= wordTimestamps[i].start) {
        activeIndex = i;

        // Check if we're very close to the next word's start time
        // This helps catch small words that might be skipped
        if (i < wordTimestamps.length - 1 &&
          currentTime > wordTimestamps[i + 1].start - TOLERANCE) {
          activeIndex = i + 1;
        }

        // Check if we're past the current word's end time
        if (currentTime > wordTimestamps[i].end + TOLERANCE) {
          // If we're between words, clear highlighting
          const isInGap = i < wordTimestamps.length - 1 &&
            currentTime < wordTimestamps[i + 1].start - TOLERANCE;
          if (isInGap) {
            clearHighlights();
            return;
          }
        }
      } else {
        break;
      }
    }
  }

  // If no suitable word was found, default to the first word
  if (activeIndex === -1) {
    activeIndex = 0;
  }

  // Remove highlight from all spans.
  const spans = element.querySelectorAll("span[data-word-index]");
  spans.forEach(span => {
    span.classList.remove("bg-yellow-300");
    span.classList.remove("rounded-lg");
    span.classList.remove("text-black");
  });

  // Highlight the active word.
  const activeSpan = element.querySelector(`span[data-word-index="${activeIndex}"]`);
  if (activeSpan) {
    activeSpan.classList.add("bg-yellow-300");
    activeSpan.classList.add("rounded-lg");
    activeSpan.classList.add("text-black");
  }
}
