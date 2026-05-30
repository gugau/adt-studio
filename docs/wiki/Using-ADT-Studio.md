# Using ADT Studio

This guide walks you through every step of converting a print textbook PDF into a finished Accessible Digital Textbook (ADT) using ADT Studio.

---

## Prerequisites

Before you begin you will need:

| Requirement | Notes |
|-------------|-------|
| **A PDF of the textbook** | Clean, machine-readable PDFs work best. Scanned image-only PDFs will produce lower-quality results. |
| **An OpenAI API key** | ADT Studio uses OpenAI models (e.g. GPT-4o) for content extraction and generation. Get one at [platform.openai.com](https://platform.openai.com/). |
| **A running ADT Studio instance** | See [Getting Started](#getting-started) below. |

---

## Getting Started

### Option A — Docker (recommended)

The quickest way to run ADT Studio. All you need is [Docker](https://docs.docker.com/get-docker/).

```bash
# Download the docker-compose.yml from the latest release, then:
docker compose up          # starts on http://localhost:8080
```

Or with a single command (no compose file):

```bash
docker run -p 8080:80 -v ./books:/app/books ghcr.io/unicef/adt-studio:latest
```

Open your browser at **http://localhost:8080**.

### Option B — Windows one-click launcher

Download `windows-setup-and-run.bat` from the [latest release](https://github.com/unicef/adt-studio/releases/latest) and double-click it. The script checks prerequisites, clones the repository, and opens the application automatically.

### Option C — Desktop app

Download the installer for your operating system from the [latest release](https://github.com/unicef/adt-studio/releases/latest) and run it. The desktop app bundles everything — no Docker, no separate server.

---

## Step 1 — Set Your API Key

The first time you open ADT Studio, click the **Settings** icon (gear icon, top-right corner) and paste your OpenAI API key. The key is stored only in your browser's local storage and is sent directly to OpenAI — it is never stored on the server.

> **Team deployments**: If your administrator has configured a server-level API key, you can skip this step.

---

## Step 2 — Create a New Book

1. Click **New Book** on the home screen.
2. Enter a **label** for the book — a short, unique identifier using letters, numbers, hyphens, or underscores (e.g. `grade-5-science-2024`). The label becomes the folder name on disk.
3. **Upload the PDF** — drag and drop or click to browse.
4. Click **Create**.

ADT Studio creates a new book directory and stores the PDF alongside its extracted data. You can come back to this book at any time — all progress is saved automatically.

---

## Step 3 — Configure the Book (optional)

Each book can have its own configuration that overrides the global settings. Click the **Settings** tab inside the book to customise:

| Setting | What it controls |
|---------|-----------------|
| **Target languages** | Which languages to translate the content into |
| **Render strategy** | How each page type is laid out in HTML (template-based or LLM-generated) |
| **LLM models** | Which OpenAI model to use for each pipeline step |
| **Image filters** | Minimum image size, meaningfulness threshold |

For most books, the default configuration works well and no changes are needed.

---

## Step 4 — Run the Pipeline

The pipeline is organised into stages that run in sequence. Each stage can be triggered independently or you can click **Run All** to run the entire pipeline from start to finish.

### Pipeline Stages

| Stage | What it does |
|-------|-------------|
| **Extract** | Renders every PDF page to a high-resolution image, extracts the raw text, identifies and crops images |
| **Storyboard** | Uses an LLM to read the visual layout of each page and produce a structured content tree; renders each section as accessible HTML |
| **Quizzes** | Generates interactive questions from the book's reading sections |
| **Captions** | Generates alt-text descriptions for every meaningful image |
| **Glossary** | Extracts and defines key vocabulary terms from the book |
| **Translate** | Translates the full text catalog into every configured target language |
| **Speech** | Generates text-to-speech audio for every section using the translated text |
| **Package** | Bundles everything into a self-contained offline web application |

### Running a stage

Click **Run** next to any stage. A progress bar shows live updates as each step within the stage completes. You can monitor individual step progress and view LLM call details by expanding a stage card.

> **LLM caching**: ADT Studio caches every LLM call by hashing the inputs. If you re-run a stage after fixing a configuration error, only the steps with changed inputs will hit the API again — unchanged steps return instantly from cache.

### Reviewing and re-running

After each stage completes, you can inspect the results directly in the UI:

- **Storyboard** — preview each page as rendered HTML; flag pages that need manual review
- **Quizzes** — read through generated questions and answers
- **Glossary** — check extracted terms
- **Captions** — review image alt-text

If you are not satisfied with any output, adjust the configuration or prompt and re-run that stage. Because of entity versioning, the previous version is always preserved — you can roll back at any time.

---

## Step 5 — Review Accessibility

ADT Studio's pipeline builds in accessibility from the start, but a human review pass is recommended before publication. Things to check:

- **Image alt-text** — are the generated captions accurate and meaningful?
- **Heading structure** — does the heading hierarchy on each page make sense for screen reader navigation?
- **Activity instructions** — are quiz questions clear and unambiguous?
- **Language quality** — are translations accurate for the target audience?

---

## Step 6 — Package and Download

Once all stages have completed:

1. Open the **Package** stage.
2. Click **Run** to generate the final output bundle.
3. When packaging is complete, click **Download** to save the bundle as a `.zip` file.

The zip contains a complete, self-contained web application — HTML, CSS, JavaScript, images, audio, and an offline manifest. It can be unzipped and opened directly in a browser with no server required, or deployed to any web host.

---

## Understanding the Output Structure

The packaged output looks like this:

```
your-book-name/
├── index.html           # Entry point — opens in any browser
├── assets/              # CSS and JavaScript
├── pages/               # One HTML file per storyboard page
├── images/              # Extracted and cropped images
├── audio/               # Text-to-speech audio files (per section, per language)
└── manifest.json        # Offline-capable web app manifest
```

---

## Frequently Asked Questions

**How long does processing take?**
Processing time depends on the number of pages, the configured LLM models, and your OpenAI API rate limits. A 100-page textbook typically takes 20–60 minutes for a full run. LLM caching makes re-runs much faster.

**What if a page is not rendered correctly?**
You can re-run individual stages after adjusting configuration. The previous version of each entity is always preserved, so you can compare results.

**Can I process a book in multiple sessions?**
Yes. All progress is saved automatically. Close the browser and come back — the book will be exactly where you left it.

**Does the source PDF need to be a specific format?**
ADT Studio works best with native (not scanned) PDFs where the text layer is embedded. Scanned PDFs will still work but the quality of extraction depends on the quality of the scan.

**Is my data sent to OpenAI?**
Textbook content (page images and extracted text) is sent to OpenAI's API for processing. You are subject to OpenAI's data usage and privacy policies. If your content is sensitive or subject to data residency requirements, review these policies before use.

---

## Next Steps

- [Hosting the Output](Hosting-the-Output) — learn how to publish your finished ADT
