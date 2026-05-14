import { existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import process from "node:process";

const AGENTS = {
  claude: { target: "CLAUDE.md", method: "import", content: "@AGENTS.md\n" },
  cursor: { target: ".cursorrules", method: "symlink" },
  windsurf: { target: ".windsurfrules", method: "symlink" },
  cline: { target: ".clinerules", method: "symlink" },
  copilot: { target: ".github/copilot-instructions.md", method: "symlink" },
};

const supported = Object.keys(AGENTS).join(", ");
const names = process.argv.slice(2);

if (names.length === 0) {
  console.error("Usage: pnpm install:agent <name> [<name>...]");
  console.error(`Supported: ${supported}`);
  process.exit(1);
}

if (!existsSync("AGENTS.md")) {
  console.error("AGENTS.md not found. Run from the repo root.");
  process.exit(1);
}

for (const name of names) {
  const config = AGENTS[name];
  if (!config) {
    console.error(`Unknown agent "${name}". Supported: ${supported}`);
    process.exitCode = 1;
    continue;
  }

  const { target, method, content } = config;

  if (existsSync(target)) {
    console.log(`${target} already exists, skipping.`);
    continue;
  }

  const targetDir = resolve(dirname(target));
  mkdirSync(targetDir, { recursive: true });

  if (method === "import") {
    writeFileSync(target, content);
    console.log(`Created ${target} (imports AGENTS.md).`);
    continue;
  }

  const rel = relative(targetDir, resolve("AGENTS.md"));
  try {
    symlinkSync(rel, target);
    console.log(`Linked ${target} -> ${rel}`);
  } catch (err) {
    if (err.code === "EPERM" || err.code === "EACCES") {
      console.error(
        `Failed to symlink ${target}: ${err.code}. On Windows this requires ` +
          `Administrator or Developer Mode.`,
      );
      process.exitCode = 1;
      continue;
    }
    throw err;
  }
}
