require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function findExeFile(dir) {
  // Look for *.exe files in the output directory
  const files = fs.readdirSync(dir);
  const exe = files.find((f) => f.endsWith(".exe"));
  if (!exe) {
    throw new Error(`No .exe file found in ${dir}`);
  }
  return path.join(dir, exe);
}

exports.default = async function (context) {
  const { electronPlatformName, appOutDir } = context;
  console.log(
    `Sign context: platform=${electronPlatformName}, appOutDir=${appOutDir}`,
  );

  if (process.env.SKIP_NOTARIZE === "true") {
    console.warn("Skipping notarization/signing due to SKIP_NOTARIZE=true");
    return;
  }

  // macOS signing + notarization is handled by electron-builder's built-in
  // `mac.notarize` config, which signs and notarizes BOTH the .app and the
  // .dmg (the manual flow only handled the .app, leaving the .dmg unsigned
  // and rejected by Gatekeeper on quarantined downloads).
  if (electronPlatformName === "darwin") {
    return;
  }

  if (electronPlatformName?.includes("win")) {
    const AZ_TOKEN = process.env.AZ_TOKEN;

    if (!AZ_TOKEN) {
      throw new Error(
        "Missing AZ_TOKEN environment variable for Windows signing",
      );
    }

    const exeFile = findExeFile(appOutDir);
    console.log(`Signing Windows executable: ${exeFile}`);

    const result = spawnSync(
      "java",
      [
        "-jar",
        "jsign.jar",
        "--storetype",
        "TRUSTEDSIGNING",
        "--keystore",
        "eus.codesigning.azure.net",
        "--storepass",
        AZ_TOKEN,
        "--alias",
        "NEES/neespnld",
        exeFile,
      ],
      { stdio: "inherit" },
    );

    if (result.status !== 0) {
      throw new Error(`Windows signing failed for ${exeFile}`);
    }

    console.log("Windows executable signed successfully.");
  }
};
