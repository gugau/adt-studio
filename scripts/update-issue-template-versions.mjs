// Prepends a new tag to every `type: dropdown` block with `id: version`
// found under .github/ISSUE_TEMPLATE/*.yml. Preserves formatting and comments.
//
// Usage: node scripts/update-issue-template-versions.mjs <tag>

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const tag = process.argv[2];
if (!tag) {
  console.error("Usage: update-issue-template-versions.mjs <tag>");
  process.exit(1);
}

const dir = ".github/ISSUE_TEMPLATE";
const files = readdirSync(dir).filter(
  (f) => f.endsWith(".yml") || f.endsWith(".yaml"),
);

const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alreadyPresent = new RegExp(`^\\s*-\\s+${escapedTag}\\s*$`, "m");

let changedCount = 0;

for (const file of files) {
  const path = join(dir, file);
  const original = readFileSync(path, "utf8");

  if (alreadyPresent.test(original)) {
    console.log(`${file}: ${tag} already present, skipping`);
    continue;
  }

  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const lines = original.split(/\r?\n/);

  // State machine: we walk top-level body items (`- type: ...`). When we hit
  // a dropdown whose id is `version`, we wait for its `options:` key and
  // insert the new tag as the first option.
  let state = "idle";
  let inserted = false;
  const out = [];

  for (const line of lines) {
    out.push(line);

    if (/^\s*-\s+type:\s*\S/.test(line)) {
      state = /^\s*-\s+type:\s*dropdown\s*$/.test(line) ? "dropdown" : "idle";
      continue;
    }

    if (state === "dropdown" && /^\s*id:\s*version\s*$/.test(line)) {
      state = "versionDropdown";
      continue;
    }

    if (
      state === "versionDropdown" &&
      /^\s*attributes:\s*$/.test(line)
    ) {
      state = "versionAttributes";
      continue;
    }

    if (
      state === "versionAttributes" &&
      /^\s*options:\s*$/.test(line)
    ) {
      const indent = line.match(/^(\s*)/)[1] + "  ";
      out.push(`${indent}- ${tag}`);
      inserted = true;
      state = "idle";
    }
  }

  if (inserted) {
    writeFileSync(path, out.join(eol));
    console.log(`${file}: prepended ${tag}`);
    changedCount += 1;
  } else {
    console.log(`${file}: no version dropdown found`);
  }
}

if (changedCount === 0) {
  console.log("No files changed.");
}
