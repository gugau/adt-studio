# Releasing

This document describes how ADT Studio is versioned and released, the branching
model behind it, and exactly what the release pipeline
([`.github/workflows/release.yml`](../.github/workflows/release.yml)) does.

> **TL;DR**
> - Feature branches merge into **`develop`** → produces **beta** releases (`vX.Y.Z-beta.N`), published often for QA.
> - Once a beta is validated, **`develop`** merges into **`main`** → produces a **stable** release (`vX.Y.Z`).
> - You never push a tag by hand. You trigger a release with a `RELEASE:` commit (or the manual button); the pipeline creates the tag, builds everything, and publishes the GitHub release.

---

## Branching & release model

```
 feature/*  ──merge──▶  develop  ──merge──▶  main
                          │                    │
                          ▼                    ▼
                   beta release          stable release
                 vX.Y.Z-beta.N               vX.Y.Z
              (frequent, for QA)        (validated, public)
```

| Branch | Release track | Tag format | Audience | Cadence |
|--------|---------------|------------|----------|---------|
| `develop` | **beta** (prerelease) | `vX.Y.Z-beta.N` | QA / internal testers | Frequent |
| `main` | **stable** | `vX.Y.Z` | End users | On approval |

**The contract is enforced by the pipeline** (see [Branch contract](#branch-contract)):
- A release on `develop` **must** be a `vX.Y.Z-beta.N` tag — a stable tag is rejected.
- A release on `main` **must** be a `vX.Y.Z` tag — a prerelease tag is rejected.

This guarantees a beta never leaks to the stable channel and vice versa.

### Day-to-day flow

1. Developers open PRs from `feature/*` branches into **`develop`**.
2. When enough has landed, a maintainer cuts a **beta** from `develop` (see
   [Triggering a release](#triggering-a-release)). QA installs/updates and tests it.
3. More betas (`-beta.2`, `-beta.3`, …) are cut as fixes land — this is meant to
   be frequent and cheap.
4. Once a beta line is approved, **`develop` is merged into `main`** and a
   **stable** release is cut from `main`.

---

## Triggering a release

There are two ways to start a release. Both run the exact same pipeline.

### 1. `RELEASE:` commit (recommended)

Push a commit to `develop` or `main` whose **subject line** starts with `RELEASE:`
followed by the tag:

```bash
# On develop — beta
git commit --allow-empty -m "RELEASE: v0.8.0-beta.1"
git push origin develop

# On main — stable
git commit --allow-empty -m "RELEASE: v0.8.0"
git push origin main
```

Notes:
- The `RELEASE:` prefix is matched **case-insensitively** by the tag extractor.
- The `v` prefix is optional in the message — it is added automatically.
- Only the **head commit** of the push is inspected.

### 2. Manual dispatch

From the GitHub UI: **Actions → Release → Run workflow**, pick the branch, and
enter the tag (e.g. `v0.8.0-beta.1` on `develop`, `v0.8.0` on `main`).

---

## Pipeline overview

The workflow runs four jobs. Builds happen first; the tag and the public release
are created **only after every build succeeds**, so a failed build never leaves a
dangling tag or a half-published release.

```
              ┌─────────────┐
              │   prepare   │  validate tag, classify beta/stable,
              │             │  bump version, stage metadata
              └──────┬──────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
   ┌─────────────┐       ┌─────────────┐
   │   desktop   │       │   docker    │   (run in parallel)
   │ (3 OS matrix)│      │ build & push │
   └──────┬──────┘       └──────┬──────┘
          └──────────┬──────────┘
                     ▼
              ┌─────────────┐
              │  finalize   │  commit metadata, push tag,
              │             │  create GitHub release
              └─────────────┘
```

### `prepare`

Gated by `if`: runs only on a manual dispatch **or** when the head commit subject
starts with `RELEASE:`. It then:

1. **Extracts the tag** from the commit subject or the dispatch input, prepends
   `v` if missing, and validates its character set (also blocks injection).
2. **Rejects a tag that already exists** on the remote — bump the version instead.
3. **Classifies the tag**:
   - `vX.Y.Z-beta[.N]` → `prerelease = true`
   - `vX.Y.Z` → `prerelease = false`
   - anything else → **error** (the only accepted formats are stable and beta).
4. <a id="branch-contract"></a>**Enforces the branch contract**:
   - `develop` only accepts beta tags.
   - `main` only accepts stable tags.
5. **Computes the Docker tag list**: always `ghcr.io/unicef/adt-studio:<tag>`;
   stable releases additionally move `:latest`.
6. **Bumps `apps/desktop/package.json`** to the release version (used by
   electron-builder for installer naming and the auto-update channel).
7. **Updates the issue-template version dropdowns** and stages the changed files
   as a `release-metadata` artifact (committed later by `finalize`).

### `desktop`

Matrix build across **macOS, Windows, and Linux**. For each OS it builds the
workspace, builds the Electron app, packages installers, and signs them:

| OS | Output | Signing |
|----|--------|---------|
| macOS | `.dmg`, `.zip` | Apple Developer ID + notarization |
| Windows | `.exe` (NSIS) | Azure Trusted Signing via `jsign` |
| Linux | `.AppImage`, `.deb` | — |

Installers and the auto-update channel manifests (`latest*.yml` for stable,
`beta*.yml` for beta) are uploaded as per-OS artifacts.

### `docker`

Builds the combined single-image (`app` target) and pushes it to GHCR with the
tags computed in `prepare`:

- **Stable** → `ghcr.io/unicef/adt-studio:vX.Y.Z` **and** `:latest`
- **Beta** → `ghcr.io/unicef/adt-studio:vX.Y.Z-beta.N` **only** (never `:latest`)

A beta image therefore never overwrites the `:latest` tag that production
`docker run` / `docker compose` users pull.

### `finalize`

Runs only after `desktop` and `docker` both succeed. It:

1. Restores the staged metadata and downloads all installer artifacts.
2. Commits the metadata bump (`chore(release): <tag>`) and pushes it to the
   release branch. *(This push uses `GITHUB_TOKEN`, which by design does **not**
   re-trigger the workflow — no release loop.)*
3. Creates and pushes the git **tag**.
4. Generates a standalone `docker-compose.yml` from the release template.
5. Creates the **GitHub release** with auto-generated notes, attaching the
   installers, the `docker-compose.yml`, and the Windows launcher script.
   Beta releases are marked as **pre-release** (`--prerelease`), so they never
   become GitHub's "Latest release".

---

## Auto-updates (desktop)

The desktop app follows the **release channel that matches the build it is
running**, so testers and end users stay on their respective tracks:

| Installed build | Update channel | Sees |
|-----------------|----------------|------|
| Stable (`vX.Y.Z`) | `latest` | Stable releases only |
| Beta (`vX.Y.Z-beta.N`) | `beta` | Beta releases (and newer stable, per electron-builder's cumulative channel model) |

This is configured in
[`apps/desktop/src/main/services/auto-updater.ts`](../apps/desktop/src/main/services/auto-updater.ts):
the updater enables prereleases and selects the `beta` channel **only** when the
running version is itself a beta; stable installs use the `latest` channel and
ignore prereleases.

> **Note on the beta channel.** Per electron-builder's
> [channel model](https://www.electron.build/tutorials/release-using-channels.html),
> the `beta` channel is cumulative: a beta install also receives newer **stable**
> releases. This is intentional — a tester is never stranded on an old beta and
> graduates to the stable build automatically. A stable install, however, never
> receives betas.

The Docker distribution has no equivalent cumulative channel: users pin an
explicit image tag, and only `:latest` moves with stable releases.

---

## What gets published

Each release produces:

- **Desktop installers** — Windows `.exe`, macOS `.dmg`/`.zip`, Linux
  `.AppImage`/`.deb`, plus the `*.yml` auto-update manifests.
- **Docker image** — pushed to `ghcr.io/unicef/adt-studio` (see tag rules above).
- **GitHub release** — installers + a ready-to-use `docker-compose.yml` +
  `windows-setup-and-run.bat`, with auto-generated changelog notes. Marked
  pre-release for betas.

---

## Quick reference

```bash
# Cut a beta from develop (QA build)
git switch develop
git commit --allow-empty -m "RELEASE: v0.8.0-beta.1"
git push origin develop

# Promote to stable: merge develop → main, then cut a stable release
git switch main
git merge --no-ff develop
git commit --allow-empty -m "RELEASE: v0.8.0"
git push origin main
```

| Rule | Stable (`main`) | Beta (`develop`) |
|------|-----------------|------------------|
| Tag format | `vX.Y.Z` | `vX.Y.Z-beta.N` |
| GitHub release | normal | pre-release |
| Docker `:latest` | moved | untouched |
| Desktop channel | `latest` | `beta` |
| Frequency | on approval | frequent |
