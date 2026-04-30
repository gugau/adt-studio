const WORD_PATTERN = /[\p{L}\p{N}\p{M}]+(?:[’'-][\p{L}\p{N}\p{M}]+)*/gu;

export function normalizeHighlightText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

export function extractHighlightableWords(text) {
  return Array.from(String(text ?? "").matchAll(WORD_PATTERN), (match) => match[0]);
}

export function normalizeGlossaryText(text) {
  return extractHighlightableWords(String(text ?? "").toLowerCase()).join(" ").trim();
}

export function getApproximateWordWeight(word) {
  const normalized = normalizeGlossaryText(word).replace(/\s+/g, "");
  return Math.max(1, normalized.length || String(word ?? "").length || 1);
}

export function createApproximateWordTimestamps(text, audioDuration) {
  const words = extractHighlightableWords(normalizeHighlightText(text));
  if (words.length === 0) return [];

  const duration = Number.isFinite(audioDuration) && audioDuration > 0
    ? audioDuration
    : Math.max(words.length * 0.42, 0.8);
  const totalWeight = words.reduce((sum, word) => sum + getApproximateWordWeight(word), 0);

  let cursor = 0;
  return words.map((word, index) => {
    const start = cursor;
    if (index === words.length - 1) {
      cursor = duration;
    } else {
      cursor += duration * (getApproximateWordWeight(word) / totalWeight);
    }

    return {
      text: word,
      start,
      end: cursor,
    };
  });
}

export function buildWordRenderPlan(text) {
  const source = String(text ?? "");
  const segments = [];
  let lastIndex = 0;
  let wordIndex = 0;

  for (const match of source.matchAll(WORD_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({
        type: "separator",
        text: source.slice(lastIndex, start),
      });
    }

    segments.push({
      type: "word",
      text: match[0],
      normalizedText: normalizeGlossaryText(match[0]),
      wordIndex,
    });
    wordIndex += 1;
    lastIndex = start + match[0].length;
  }

  if (lastIndex < source.length) {
    segments.push({
      type: "separator",
      text: source.slice(lastIndex),
    });
  }

  return segments;
}

export function isWordHighlightEnabled(highlightFeatureEnabled, wordHighlightMode = true) {
  return Boolean(highlightFeatureEnabled) && wordHighlightMode !== false;
}

export function shouldUseBlockPlaybackHighlight(
  element,
  highlightFeatureEnabled,
  wordHighlightMode = true,
) {
  const tagName = element?.tagName?.toLowerCase?.();
  if (!tagName) {
    return false;
  }

  if (!isWordHighlightEnabled(highlightFeatureEnabled, wordHighlightMode)) {
    return true;
  }

  return tagName === "img" || tagName === "input" || tagName === "textarea";
}

export function getHighlightDisplayText(element, translatedText) {
  const renderedText = String(element?.textContent ?? "");
  return normalizeHighlightText(renderedText).length > 0
    ? renderedText
    : String(translatedText ?? "");
}
