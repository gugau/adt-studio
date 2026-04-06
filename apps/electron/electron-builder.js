const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const extraResources = [
  {
    from: "../../prompts",
    to: "prompts",
  },
  {
    from: "../../templates",
    to: "templates",
  },
  {
    from: "../../config.yaml",
    to: "config.yaml",
  },
  {
    from: "../../config",
    to: "config",
  },
  {
    from: "../../assets",
    to: "assets",
  },
];

const version = (process.env.APP_VERSION || require("./package.json").version)
const productName = "ADT-Studio";
const artifactName =  `${productName}-\${version}.\${ext}`
.toLowerCase()
.replace(/ /g, '-');

const config = {
  appId: "com.nees.adt-studio",
  productName,
  directories: {
    buildResources: "build",
    output: "release",
  },
  extraMetadata: {
    version
  },
  extraResources,
  // Native/tooling deps live next to api-server.mjs; they cannot load from asar.
  asarUnpack: [
    "out/main/api-server.mjs",
    "out/main/*.wasm",
    "out/main/node_modules/**",
  ],
  files: [
    "out/**/*",
    "!out/renderer/placeholder-*",
  ],
  win: {
    target: ["nsis"],
    icon: "build/icon.ico",
  },
  nsis: {
    artifactName,
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
  mac: {
    target: ["dmg"],
    icon: "build/icon.icns",
    entitlementsInherit: "build/entitlements.mac.plist",
  },
  linux: {
    target: ["AppImage"],
    icon: "build",
  }
};

module.exports = config;