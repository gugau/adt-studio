// Rewrites the `options:` list of every `type: dropdown` block with
// `id: version` found under .github/ISSUE_TEMPLATE/*.yml so that it lists:
//   - the 3 most recent beta / pre-release versions
//   - the 3 most recent official (stable) versions
//   - any non-version entries from the existing dropdown (e.g. "Older / unsure"),
//     in their original order
// The candidate set comes from `git tag --list`. An optional <tag> argument is
// folded into the candidates so the script can include a not-yet-pushed tag
// (e.g. during a release run where the tag is created later in the pipeline).
// Formatting, indentation, and line endings are preserved.
//
// Usage: node scripts/update-issue-template-versions.mjs [<tag>]

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const extraTag = process.argv[2] ?? null;

const KEEP_OFFICIAL = 3;
const KEEP_BETA = 3;

function parseVersion(raw) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(raw.trim());
  if (!match) return null;
  return {
    raw,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

function comparePrerelease(a, b) {
  const ap = a.split(".");
  const bp = b.split(".");
  const len = Math.max(ap.length, bp.length);
  for (let i = 0; i < len; i++) {
    if (ap[i] === undefined) return -1;
    if (bp[i] === undefined) return 1;
    const an = /^\d+$/.test(ap[i]);
    const bn = /^\d+$/.test(bp[i]);
    if (an && bn) {
      const diff = Number(ap[i]) - Number(bp[i]);
      if (diff !== 0) return diff < 0 ? -1 : 1;
    } else if (an !== bn) {
      return an ? -1 : 1;
    } else if (ap[i] !== bp[i]) {
      return ap[i] < bp[i] ? -1 : 1;
    }
  }
  return 0;
}

function compareVersions(a, b) {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  if (a.prerelease === null && b.prerelease === null) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  return comparePrerelease(a.prerelease, b.prerelease);
}

function listGitTags() {
  try {
    const out = execFileSync("git", ["tag", "--list"], { encoding: "utf8" });
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch (err) {
    console.error(
      "Failed to list git tags. Run this script inside a git repository " +
        "with access to its tags (e.g. checkout with fetch-tags: true).",
    );
    console.error(err.message);
    process.exit(1);
  }
}

function topVersions(candidates) {
  const seen = new Set();
  const versions = [];
  for (const raw of candidates) {
    if (seen.has(raw)) continue;
    seen.add(raw);
    const parsed = parseVersion(raw);
    if (parsed) versions.push(parsed);
  }
  const desc = (a, b) => compareVersions(b, a);
  const official = versions
    .filter((v) => v.prerelease === null)
    .sort(desc)
    .slice(0, KEEP_OFFICIAL);
  const beta = versions
    .filter((v) => v.prerelease !== null)
    .sort(desc)
    .slice(0, KEEP_BETA);
  return [...beta.map((v) => v.raw), ...official.map((v) => v.raw)];
}

const gitTags = listGitTags();
const candidates = extraTag ? [...gitTags, extraTag] : gitTags;
const topList = topVersions(candidates);

const dir = ".github/ISSUE_TEMPLATE";
const files = readdirSync(dir).filter(
  (f) => f.endsWith(".yml") || f.endsWith(".yaml"),
);

let changedCount = 0;

for (const file of files) {
  const path = join(dir, file);
  const original = readFileSync(path, "utf8");

  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const lines = original.split(/\r?\n/);

  let state = "idle";
  let foundVersion = false;
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^\s*-\s+type:\s*\S/.test(line)) {
      state = /^\s*-\s+type:\s*dropdown\s*$/.test(line) ? "dropdown" : "idle";
      out.push(line);
      continue;
    }

    if (state === "dropdown" && /^\s*id:\s*version\s*$/.test(line)) {
      state = "versionDropdown";
      out.push(line);
      continue;
    }

    if (state === "versionDropdown" && /^\s*attributes:\s*$/.test(line)) {
      state = "versionAttributes";
      out.push(line);
      continue;
    }

    if (state === "versionAttributes" && /^\s*options:\s*$/.test(line)) {
      out.push(line);
      const optionIndent = line.match(/^(\s*)/)[1] + "  ";

      // Read the existing options so we can preserve any non-version entries
      // (e.g. "Older / unsure"). Their original order is kept.
      const existing = [];
      while (
        i + 1 < lines.length &&
        lines[i + 1].startsWith(optionIndent) &&
        lines[i + 1].slice(optionIndent.length).startsWith("- ")
      ) {
        i += 1;
        existing.push(lines[i].slice(optionIndent.length + 2).trim());
      }
      const others = existing.filter((o) => parseVersion(o) === null);

      for (const opt of [...topList, ...others]) {
        out.push(`${optionIndent}- ${opt}`);
      }

      foundVersion = true;
      state = "idle";
      continue;
    }

    out.push(line);
  }

  const updated = out.join(eol);

  if (!foundVersion) {
    console.log(`${file}: no version dropdown found`);
  } else if (updated === original) {
    console.log(`${file}: already up to date, skipping`);
  } else {
    writeFileSync(path, updated);
    console.log(`${file}: updated version options`);
    changedCount += 1;
  }
}

if (changedCount === 0) {
  console.log("No files changed.");
}
