require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { notarize } = require("@electron/notarize");

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
    `Notarization context: platform=${electronPlatformName}, appOutDir=${appOutDir}`,
  );

  if (process.env.SKIP_NOTARIZE === "true") {
    console.warn("Skipping notarization/signing due to SKIP_NOTARIZE=true");
    return;
  }

  if (electronPlatformName === "darwin") {
    const { APPLEID, APPLEIDPASS, APPLEIDTEAM } = process.env;

    if (!APPLEID || !APPLEIDPASS || !APPLEIDTEAM) {
      console.warn("Skipping macOS notarization: missing Apple credentials");
      return;
    }

    const appName = context.packager.appInfo.productFilename;
    const appPath = path.join(appOutDir, `${appName}.app`);

    console.log("Starting macOS notarization...");

    return notarize({
      tool: "notarytool",
      appBundleId: "com.nees.adt-studio",
      appPath,
      appleId: APPLEID,
      appleIdPassword: APPLEIDPASS,
      ascProvider: APPLEIDTEAM,
      teamId: APPLEIDTEAM,
    });
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
