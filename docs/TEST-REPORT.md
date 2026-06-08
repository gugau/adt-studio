# Relatório de Testes — ADT Studio

**Data:** 2026-06-03  
**Branch:** `main`  
**Ambiente:** Windows 10, Node.js 24, Electron 41.2.0, Playwright 1.60.0, Vitest 4.0.18

---

## Resumo executivo

| Camada | Arquivos | Total | ✅ Passando | ❌ Falhando | ⏭ Skip |
|---|---|---|---|---|---|
| Unitários (Vitest) | 88 | 1.109 | 1.108 | 1 | — |
| E2E Desktop (Playwright) | 5 | 46 | 45 | 0 | 1 |
| **Total** | **93** | **1.155** | **1.153** | **1** | **1** |

**Taxa de sucesso: 99,9%**

---

## Testes unitários (Vitest)

### Por área

| Área | Arquivos de teste | Descrição |
|---|---|---|
| `packages/pipeline` | 22 | Todos os 8 estágios do pipeline — extração de PDF, sectioning, quizzes, speech, render, glossário, tradução, acessibilidade |
| `packages/llm` | 7 | Cache, cliente multi-provider (OpenAI/Anthropic/Gemini), rate limiter, prompts, speech |
| `packages/pdf` | 5 | Extração de texto e imagem, clipping, spread mode, suporte Sinhala |
| `packages/types` | 5 | Schemas Zod, book label, pipeline effects, section tree ops |
| `packages/storage` | 2 | SQLite via WASM, book storage, versionamento de nós |
| `apps/api` — rotas | 13 | `books`, `pages`, `stages`, `health`, `glossary`, `debug`, `tts`, `package`, `adt-preview`, `reviewer-validation`, `prompts` |
| `apps/api` — services | 4 | `book-service`, `stage-runner`, `export-service`, `page-edit-service` |
| `apps/studio` — lógica | 10 | Hooks, lib utils, configuração de estágios, i18n do pipeline |
| `apps/studio` — acessibilidade | 2 | `ToggleCard` e `DeleteBookDialog` com axe-core (WCAG 2.1) |
| `apps/adt-runtime` | 2 | Tokenizer de áudio, navegação por teclado |

### Falha conhecida

| Teste | Arquivo | Tipo | Causa |
|---|---|---|---|
| `stores accessibility assessment output after packaging` | `apps/api/src/routes/package.test.ts` | Flaky | Timeout esporádico causado por ausência do pacote `canvas` no jsdom — falha ~20% das execuções |

---

## Testes E2E Desktop (Playwright + Electron)

Todos os testes E2E usam o app Electron compilado (`pnpm build:desktop`) e se conectam via CDP (`chromium.connectOverCDP`). Cada teste recebe um `--user-data-dir` isolado em `tmp/`.

### Por arquivo

| Arquivo | Testes | Status | O que verifica |
|---|---|---|---|
| `electron-bridge.spec.ts` | 13 | ✅ todos | IPC context bridge — `window.api`, `window.electron`, `process.type`, `windowControls`, `updates` |
| `pipeline.spec.ts` | 17 | ✅ todos | Health da API, CRUD de livros, shape do `step-status`, SPA sem erros JS no console |
| `stage-queue.spec.ts` | 9 | ✅ todos | Validação de `/stages/run` (sem chave, body inválido, livro inexistente), fila de runs, SSE stream, tasks endpoint |
| `versioning.spec.ts` | 6 | ✅ 5 / ⏭ 1 | Histórico de step runs, isolamento entre livros, delete lifecycle, source-pdf info |
| `accessibility.spec.ts` | 5 | ✅ todos | Auditoria WCAG 2.1 AA no app real via axe-core, navegação por Tab, ausência de keyboard trap |

> **Skip intencional** em `versioning.spec.ts`: o teste de fingerprint de versão requer a variável de ambiente `RAVEN_EXTRACTED_BOOK_DIR` apontando para um livro pré-extraído. Não é executado no ambiente padrão.

---

## Cobertura de código

> Gerada com `@vitest/coverage-v8`. Relatório HTML disponível em `coverage/index.html`.  
> Executar: `pnpm test --coverage`

### Totais

| Métrica | % | Linhas cobertas |
|---|---|---|
| Statements | 29,28% | 7.116 / 24.295 |
| Branches | 21,52% | 3.546 / 16.475 |
| Functions | 21,82% | 1.081 / 4.954 |
| Lines | 30,34% | 6.699 / 22.074 |

### Por área

| Área | Stmts | Branch | Funcs | Lines | Arquivos |
|---|---|---|---|---|---|
| `packages/pdf` | 77% | 62% | 81% | **78%** | 6 |
| `packages/pipeline` | 68% | 66% | 69% | **69%** | 40 |
| `packages/types` | 68% | 68% | 80% | 68% | 28 |
| `packages/llm` | 60% | 35% | 66% | 61% | 9 |
| `apps/api` | 48% | 39% | 53% | 49% | 32 |
| `packages/storage` | 39% | 40% | 46% | 40% | 3 |
| `apps/studio` | **6%** | **5%** | **5%** | **6%** | 328 |

### Por que o total (30%) é baixo

O `apps/studio` contém **328 arquivos** de componentes React que não possuem testes unitários — eles dominam o denominador do cálculo. O núcleo funcional do produto (`packages/*` e `apps/api`) apresenta cobertura real entre **39% e 78%**, que é mais representativa da qualidade de teste do código de negócio.

### Arquivos com 100% de cobertura

| Arquivo | Linhas |
|---|---|
| `components/ui/dialog.tsx` | 22 |
| `llm/rate-limiter.ts` | 25 |
| `pdf/fm-sinhala.ts` | 25 |
| `pdf/png-utils.ts` | 32 |
| `pipeline/dag.ts` | 56 |
| `pipeline/image-captioning.ts` | 30 |
| `pipeline/image-meaningfulness.ts` | 28 |
| `pipeline/render-template.ts` | 35 |
| `pipeline/text-catalog.ts` | 82 |
| `types/pipeline-effects.ts` | 43 |

### Arquivos com menor cobertura (< 30% linhas, ≥ 20 linhas de código)

Todos os arquivos abaixo pertencem a `apps/studio` e são componentes React sem testes unitários:

- `components/ErrorScreen.tsx` (0%)
- `components/LanguagePicker.tsx` (0%)
- `components/debug/DebugPanel.tsx` (0%)
- `components/debug/LlmLogsTab.tsx` (0%)
- `components/import/ImportProject.tsx` (0%)
- `components/onboarding/OnboardingFlow.tsx` (0%)
- `components/onboarding/scenes/ApiKeyScene.tsx` (0%)
- `components/pipeline/components/LandingPageShell.tsx` (0%)

---

## Acessibilidade (WCAG 2.1)

O projeto já possuía uma camada de auditoria axe-core para o **output gerado** (livros em HTML). Em 2026-06 foram adicionados testes de acessibilidade da **própria interface do Studio**.

### Testes implementados

| Tipo | Ferramenta | Arquivo | O que garante |
|---|---|---|---|
| Componente | axe-core + jsdom | `ToggleCard.a11y.test.tsx` | Zero violações axe nos 3 estados; `role=switch`; `aria-checked`; ativação por Space/Enter; `inert` no switch decorativo; `aria-labelledby`/`aria-describedby` |
| Componente | axe-core + jsdom | `DeleteBookDialog.a11y.test.tsx` | Zero violações axe; `role=dialog` com nome acessível; Escape fecha; botões focusáveis; estado pending anunciado para AT |
| E2E | axe-core + Electron CDP | `accessibility.spec.ts` | Zero violações críticas/sérias WCAG 2.1 AA na home page e na página de detalhe do livro |
| E2E | Playwright | `accessibility.spec.ts` | Elementos interativos alcançáveis por Tab; ausência de keyboard trap |

### Bug encontrado e corrigido

Durante a implementação dos testes, o axe detectou uma violação **WCAG 4.1.2 — Name, Role, Value (serious)** no componente `ToggleCard`:

**Causa:** O switch decorativo interno utilizava `aria-hidden="true"` + `tabIndex="-1"` em um elemento `<button>` (renderizado pelo Radix UI). Essa combinação não remove completamente o elemento da árvore de acessibilidade em alguns leitores de tela que operam no modo de cursor virtual.

**Correção aplicada** em `ToggleCard.tsx`:
```tsx
// Antes
<BrandedSwitch checked={checked} decorative disabled={disabled} />

// Depois  
<span aria-hidden="true" inert>
  <BrandedSwitch checked={checked} decorative disabled={disabled} />
</span>
```

O atributo `inert` é o padrão HTML moderno para tornar um elemento e toda sua subárvore completamente inacessível a AT, teclado e pointer events.

---

## Como executar

```bash
# Todos os testes unitários
pnpm test

# Com cobertura de código
pnpm test --coverage
# → Relatório HTML em coverage/index.html

# Testes E2E (requer build prévia)
pnpm build:desktop
pnpm test:e2e

# Apenas testes de acessibilidade (unitários)
pnpm test -- --testNamePattern="a11y"

# Apenas testes de acessibilidade (E2E)
pnpm test:e2e tests/desktop/accessibility.spec.ts

# Relatório visual E2E
npx playwright show-report
```

---

## Próximos passos recomendados

| Prioridade | Área | Ação sugerida |
|---|---|---|
| 🔴 Alta | `apps/studio` (6% cobertura) | Adicionar testes de componente para as páginas principais do pipeline usando `@testing-library/react` + axe |
| 🟠 Média | `packages/llm` branches (35%) | Exercitar caminhos de fallback: Anthropic, Gemini, retry on rate-limit, cache miss |
| 🟠 Média | `packages/storage` (39%) | Cobrir edge cases do SQLite: migração de schema, concurrent writes, large datasets |
| 🟡 Baixa | UI flows E2E | Testes que clicam em botões e navegam por rotas do Studio (onboarding, upload de PDF) |
| 🟡 Baixa | Flaky fix | Corrigir `package.test.ts` — instalar `canvas` no ambiente de CI ou mockar HTMLCanvasElement |
