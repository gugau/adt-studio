// End-to-end tests for scripts/update-issue-template-versions.mjs
//
// The script is a standalone CLI that mutates `.github/ISSUE_TEMPLATE/*.yml`
// relative to the current working directory. Rather than refactor it, we run
// the real script as a child process inside a throwaway temp directory and
// assert on the resulting files, stdout, and exit code.

import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const scriptPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "update-issue-template-versions.mjs",
);

/** A minimal but realistic issue-form template with a `version` dropdown. */
function versionTemplate(options = ["v0.6.0", "v0.5.0", "Older / unsure"]) {
  return [
    "name: Bug Report",
    "description: File a bug report",
    "body:",
    "  - type: dropdown",
    "    id: version",
    "    attributes:",
    "      label: Version",
    "      description: What version are you running?",
    "      options:",
    ...options.map((o) => `        - ${o}`),
    "    validations:",
    "      required: true",
    "",
  ].join("\n");
}

let cwd;
let templateDir;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "issue-tpl-"));
  templateDir = join(cwd, ".github", "ISSUE_TEMPLATE");
  mkdirSync(templateDir, { recursive: true });
});

afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function writeTemplate(name, contents) {
  writeFileSync(join(templateDir, name), contents);
}

function readTemplate(name) {
  return readFileSync(join(templateDir, name), "utf8");
}

function run(tag) {
  const args = tag === undefined ? [scriptPath] : [scriptPath, tag];
  return spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
}

describe("update-issue-template-versions", () => {
  it("exits 1 with usage when no tag is given", () => {
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage:");
  });

  it("inserts the new tag as the first option of the version dropdown", () => {
    writeTemplate("bug_report.yml", versionTemplate());

    const result = run("v0.7.0");

    expect(result.status).toBe(0);
    const lines = readTemplate("bug_report.yml").split("\n");
    const optionsIdx = lines.findIndex((l) => l.trim() === "options:");
    expect(lines[optionsIdx + 1]).toBe("        - v0.7.0");
    expect(lines[optionsIdx + 2]).toBe("        - v0.6.0");
    expect(lines[optionsIdx + 3]).toBe("        - v0.5.0");
    expect(result.stdout).toContain("bug_report.yml: prepended v0.7.0");
  });

  it("matches the indentation of the options: key (+2 spaces)", () => {
    writeTemplate("bug_report.yml", versionTemplate());
    run("v0.7.0");
    const line = readTemplate("bug_report.yml")
      .split("\n")
      .find((l) => l.includes("v0.7.0"));
    expect(line).toBe("        - v0.7.0");
  });

  it("is idempotent: skips a file where the tag already exists", () => {
    const original = versionTemplate(["v0.7.0", "v0.6.0"]);
    writeTemplate("bug_report.yml", original);

    const result = run("v0.7.0");

    expect(result.status).toBe(0);
    expect(readTemplate("bug_report.yml")).toBe(original);
    expect(result.stdout).toContain("v0.7.0 already present, skipping");
  });

  it("treats tags with regex-special characters literally", () => {
    writeTemplate("bug_report.yml", versionTemplate(["v0X6X0"]));

    const result = run("v0.6.0");

    expect(result.status).toBe(0);
    expect(readTemplate("bug_report.yml")).toContain("- v0.6.0");
    expect(result.stdout).toContain("prepended v0.6.0");
  });

  it("only touches the version dropdown, not other dropdowns", () => {
    const tpl = [
      "body:",
      "  - type: dropdown",
      "    id: version",
      "    attributes:",
      "      label: Version",
      "      options:",
      "        - v0.6.0",
      "  - type: dropdown",
      "    id: platform",
      "    attributes:",
      "      label: Platform",
      "      options:",
      "        - Windows",
      "        - Linux",
      "",
    ].join("\n");
    writeTemplate("bug_report.yml", tpl);

    run("v0.7.0");

    const lines = readTemplate("bug_report.yml").split("\n");
    expect(lines.filter((l) => l.includes("v0.7.0"))).toHaveLength(1);
    const platformIdx = lines.findIndex((l) => l.trim() === "id: platform");
    const platformOptionsIdx = lines.findIndex(
      (l, i) => i > platformIdx && l.trim() === "options:",
    );
    expect(lines[platformOptionsIdx + 1]).toBe("        - Windows");
  });

  it("reports files that have no version dropdown without changing them", () => {
    const tpl = [
      "body:",
      "  - type: textarea",
      "    id: what-happened",
      "    attributes:",
      "      label: What happened?",
      "",
    ].join("\n");
    writeTemplate("config.yml", tpl);

    const result = run("v0.7.0");

    expect(result.status).toBe(0);
    expect(readTemplate("config.yml")).toBe(tpl);
    expect(result.stdout).toContain("config.yml: no version dropdown found");
  });

  it("processes both .yml and .yaml files", () => {
    writeTemplate("bug_report.yml", versionTemplate());
    writeTemplate("question.yaml", versionTemplate());

    const result = run("v0.7.0");

    expect(result.status).toBe(0);
    expect(readTemplate("bug_report.yml")).toContain("- v0.7.0");
    expect(readTemplate("question.yaml")).toContain("- v0.7.0");
    expect(result.stdout).toContain("bug_report.yml: prepended v0.7.0");
    expect(result.stdout).toContain("question.yaml: prepended v0.7.0");
  });

  it("ignores non-template files in the directory", () => {
    writeTemplate("README.md", "# not a template\n- v0.7.0\n");
    writeTemplate("bug_report.yml", versionTemplate());

    const result = run("v0.7.0");

    expect(result.status).toBe(0);
    expect(readTemplate("README.md")).toBe("# not a template\n- v0.7.0\n");
    expect(result.stdout).not.toContain("README.md");
  });

  it("preserves CRLF line endings", () => {
    writeTemplate("bug_report.yml", versionTemplate().replace(/\n/g, "\r\n"));

    run("v0.7.0");

    const out = readTemplate("bug_report.yml");
    expect(out).toContain("\r\n");
    expect(out).not.toMatch(/[^\r]\n/); // no bare LF
    expect(out).toContain("        - v0.7.0\r\n");
  });

  it("preserves LF line endings", () => {
    writeTemplate("bug_report.yml", versionTemplate());

    run("v0.7.0");

    const out = readTemplate("bug_report.yml");
    expect(out).not.toContain("\r\n");
  });

  it("prints a summary when no files change", () => {
    const tpl = ["body:", "  - type: input", "    id: foo", ""].join("\n");
    writeTemplate("config.yml", tpl);

    const result = run("v0.7.0");

    expect(result.stdout).toContain("No files changed.");
  });
});
