const { spawnSync } = require("node:child_process");
const path = require("node:path");

const TRUSTED_SIGNING_KEYSTORE = "eus.codesigning.azure.net";
// <TrustedSigningAccount>/<CertificateProfile> — see Azure Portal.
const TRUSTED_SIGNING_ALIAS = "NEES/neespnld";

module.exports = async function (configuration) {
  if (process.env.SKIP_NOTARIZE === "true") {
    console.warn(`SKIP_NOTARIZE=true → skipping signature for ${configuration.path}`);
    return;
  }

  const AZ_TOKEN = process.env.AZ_TOKEN;
  if (!AZ_TOKEN) {
    throw new Error("Missing AZ_TOKEN env var for Windows signing");
  }

  const target = configuration.path;
  const jsignJar = path.resolve(__dirname, "..", "jsign.jar");
  console.log(`Signing Windows file: ${target}`);

  const result = spawnSync(
    "java",
    [
      "-jar", jsignJar,
      "--storetype", "TRUSTEDSIGNING",
      "--keystore", TRUSTED_SIGNING_KEYSTORE,
      "--storepass", AZ_TOKEN,
      "--alias", TRUSTED_SIGNING_ALIAS,
      target,
    ],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    throw new Error(`Windows signing failed for ${target}`);
  }
};
