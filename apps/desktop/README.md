# ADT Desktop App (Electron)

Electron desktop wrapper for ADT Studio.

## Overview

This app packages the Studio frontend and API sidecar into a desktop build using `electron-vite` + `electron-builder`.

During build, it:
- builds Studio and API artifacts first;
- bundles Electron main/preload/renderer into `out/`;
- copies generated assets needed by Electron;
- creates platform installers in `release/`.

## Prerequisites

- Node.js 20+
- `pnpm`
- Java (required for Windows signing via `jsign.jar`)
- Platform toolchains for your target OS:
  - Windows: code signing token (Azure Trusted Signing)
  - macOS: Apple Developer credentials (for notarization)

## Install

From repository root:

```bash
pnpm install
```

```bash
pnpm build
```

## Development

Run a local production-like preview (build first, then launch):

```bash
pnpm --filter @adt/desktop start
```

## Build

From repository root:

```bash
# Build unpacked app (no installer)
pnpm --filter @adt/desktop build:unpack

# Build Windows installer (NSIS)
pnpm --filter @adt/desktop build:win

# Build macOS package (DMG)
pnpm --filter @adt/desktop build:mac

# Build Linux package (AppImage)
pnpm --filter @adt/desktop build:linux
```

All generated artifacts are written to:

```text
apps/desktop/release/
```

## Signing And Notarization

`electron-builder` runs `scripts/notarize.js` in `afterSign`.

- Windows signing requires:
  - `AZ_TOKEN`
  - `jsign.jar` available in the Electron app directory
- macOS notarization requires:
  - `APPLEID`
  - `APPLEIDPASS`
  - `APPLEIDTEAM`

To skip signing/notarization in CI or local tests:

```bash
SKIP_NOTARIZE=true pnpm --filter @adt/desktop build:win
```

### Sign and release mac version

1. Enter the desktop app folder:
   ```bash
   cd apps/desktop
   ```
2. You may need to grant execute permission to the script (optional).
3. Run `mac-sign-release`:
   ```bash
   ./scripts/mac-sign-release.sh
   ```

## Useful Notes

- App bundle identifier is configured in `electron-builder.js` (`appId`).
- macOS entitlements are in `build/entitlements.mac.plist`.
- Installer naming and platform targets are also configured in `electron-builder.js`.
