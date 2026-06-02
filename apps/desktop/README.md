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

- **Windows** signing is handled by `scripts/sign-windows.js`, wired through
  `electron-builder`'s `win.sign` callback. It is invoked once per `.exe`
  (both the inner app and the NSIS installer) and signs via `jsign` + Azure
  Trusted Signing. Requires:
  - `AZ_TOKEN` — short-lived access token (CI obtains it via OAuth)
  - `jsign.jar` next to this directory (CI downloads it; locally, download
    from Maven Central into `apps/desktop/jsign.jar`)
  - `java` on PATH

- **macOS** signing + notarization is handled by `electron-builder`'s
  built-in support — no custom script. Requires:
  - `CSC_LINK` and `CSC_KEY_PASSWORD` for the Developer ID certificate
  - `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` for notarytool

To skip signing in CI or local tests:

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
