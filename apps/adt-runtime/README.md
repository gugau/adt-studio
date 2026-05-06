# @adt/runtime

The React + Jotai chrome that hydrates around each book page. Built with
esbuild for production (emits `assets/adt/base.bundle.{local,min}.js`) and
Vite for dev iteration with HMR.

## Running the dev preview

The Vite dev server (`pnpm --filter @adt/runtime dev`, port `5174`) renders
the chrome on top of a **self-contained sample book** that lives inside
this package at `apps/adt-runtime/sample/`. The sample is a frozen copy
of a real packaged book — same directory layout as `books/<book>/adt/`,
with every page HTML, every static asset, every i18n catalog, and every
audio file in production-identical paths. TTS, glossary, navigation,
language switching, and the full i18n catalog all work end-to-end with
zero API or proxy.

The sample is **gitignored** (≈ 41 MB of audio + assets). Populate it
once with the sync script before running dev:

```bash
# Populate from the default book (pinheiros-jsx)
pnpm --filter @adt/runtime sample:sync

# Or from a different packaged book:
pnpm --filter @adt/runtime sample:sync my-other-book
```

Then start the dev server:

```bash
pnpm --filter @adt/runtime dev
```

Open `http://localhost:5174/`. You'll see the sample's `pg004005_sec001`
page (default) with the live chrome on top. Editing any chrome component
HMR-replaces it without losing playback / glossary state.

### Configuration

| Variable | Default | What it controls |
|---|---|---|
| `ADT_PREVIEW_PAGE` | `pg004005_sec001` | Page served at the root URL `/` |

The sample's source book is whatever was last passed to `pnpm sample:sync`.
The sync script's first argument is the book label under `books/`.

You can also navigate by URL — `http://localhost:5174/pg006007_sec001.html`
serves whatever page exists in the sample. The runtime's BackForwardBar /
NavMenu use `window.location.href`, so they navigate the same way they
would in a shipped book.

### How it works

| URL | Source |
|---|---|
| `/` and `/index.html` | `sample/<ADT_PREVIEW_PAGE>.html`, transformed (Vite dev runtime injected) |
| `/<page>.html` | `sample/<page>.html`, transformed |
| `/assets/sounds/*`, `/assets/fonts/*`, `/assets/favicon_io/*`, `/assets/libs/*`, `/assets/interface_translations/*`, `/assets/config.json`, etc. | `sample/assets/*` (Vite static) |
| `/content/pages.json`, `/content/toc.json`, `/content/i18n/<lang>/{texts,audios,videos,images,glossary}.json`, `/content/i18n/<lang>/timecode/timecode_output.json`, `/content/i18n/<lang>/audio/*` | `sample/content/*` (Vite static) |
| `/images/<file>` | `sample/images/<file>` (Vite static) |
| `/src/*`, `/@vite/*` | Vite dev runtime |

The `bookHtmlPlugin` middleware in `vite.config.ts` is what makes this
all work — it intercepts every `*.html` request, reads the file off disk,
strips the production bundle scripts, injects Vite's dev runtime, and
runs the result through `server.transformIndexHtml(...)` so plugins like
`@vitejs/plugin-react` get to inject their HMR preamble.

### Refreshing the sample

The sample is a snapshot — re-run `pnpm sample:sync [book-label]`
whenever you want to pull new content from a freshly packaged book.

```bash
# Refresh from default book (pinheiros-jsx)
pnpm --filter @adt/runtime sample:sync

# Pull a different book in
pnpm --filter @adt/runtime sample:sync my-book
```

If the sample directory is missing when dev starts, Vite prints a warning
and falls back to the bundled `apps/adt-runtime/public/` + the static
`index.html` shell. The runtime still boots, just without book content.

## Production build

```bash
pnpm --filter @adt/runtime build
```

Emits to `<monorepo>/assets/adt/`:
- `base.bundle.local.js` — IIFE for `<script src="...">` in book pages
- `base.bundle.min.js` (+ `.map`) — minified ESM
- `tailwind_css.css` — Tailwind v4 entry the per-book pipeline uses as input
- All `public/*` files (sounds, fonts, favicons, etc.)

`apps/api/scripts/bundle.mjs` and
`packages/pipeline/src/package-web.ts:buildJsBundle` both delegate to this
script's `build.config.mjs`.
