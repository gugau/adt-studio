# Guia de Execução de Testes — ADT Studio

Referência rápida com todos os comandos de teste em sequência lógica.

**Requisitos:** Node.js 20+, pnpm 10+

---

## 1. Preparação inicial

```bash
# Instalar todas as dependências
pnpm install

# Build dos pacotes compartilhados (necessário antes de qualquer teste)
pnpm build
```

---

## 2. Testes unitários (Vitest)

### Executar todos os testes

```bash
pnpm test
```

### Executar em modo watch (reexecuta ao salvar)

```bash
pnpm test:watch
```

### Executar com cobertura de código

```bash
pnpm test --coverage
```

> O relatório HTML de cobertura é gerado em `coverage/index.html`.

### Executar apenas uma área específica

```bash
# Testes do pipeline
pnpm test packages/pipeline

# Testes da API
pnpm test apps/api

# Testes do Studio
pnpm test apps/studio

# Testes de um arquivo específico
pnpm test apps/api/src/routes/books.test.ts
```

### Executar apenas os testes de acessibilidade (unitários)

```bash
pnpm test -- --testNamePattern="accessibility|a11y"
```

---

## 3. Testes E2E desktop (Playwright + Electron)

> Os testes E2E exigem o app Electron compilado. Execute o build uma vez antes de rodar.

### Build do app desktop (pré-requisito)

```bash
pnpm build:desktop
```

### Executar todos os testes E2E

```bash
pnpm test:e2e
```

### Executar um arquivo específico

```bash
# Testes do IPC bridge (window.api, window.electron)
pnpm test:e2e tests/desktop/electron-bridge.spec.ts

# Testes da API e pipeline
pnpm test:e2e tests/desktop/pipeline.spec.ts

# Testes de fila de estágios (stage-queue, SSE)
pnpm test:e2e tests/desktop/stage-queue.spec.ts

# Testes de versionamento e lifecycle de livros
pnpm test:e2e tests/desktop/versioning.spec.ts

# Testes de acessibilidade WCAG no app real
pnpm test:e2e tests/desktop/accessibility.spec.ts
```

### Executar com fixture de livro pré-extraído (testes avançados)

```bash
RAVEN_EXTRACTED_BOOK_DIR=./tests/fixtures/raven-extracted pnpm test:e2e
```

---

## 4. Relatórios visuais

### Abrir relatório HTML do Playwright

```bash
npx playwright show-report
# Abre em http://localhost:9323
```

### Abrir relatório de cobertura (após rodar com --coverage)

```bash
# Windows
start coverage/index.html

# macOS
open coverage/index.html

# Linux
xdg-open coverage/index.html
```

---

## 5. Acessibilidade (axe-core)

### Testes unitários com axe (componentes React)

```bash
# Todos os arquivos .a11y.test
pnpm test -- --reporter=verbose apps/studio/src/components/pipeline/components/ToggleCard.a11y.test.tsx
pnpm test -- --reporter=verbose apps/studio/src/components/books/DeleteBookDialog.a11y.test.tsx
```

### Auditoria WCAG no app Electron (E2E)

```bash
pnpm test:e2e tests/desktop/accessibility.spec.ts
```

### Auditoria axe nos livros gerados (requer livros processados)

```bash
# Auditoria com relatório em texto
pnpm a11y:regression

# Auditoria com saída JSON
pnpm a11y:regression:json

# Auditoria via browser (color-contrast + regras dependentes de layout)
pnpm a11y:browser-recheck

# Auditoria browser com saída JSON
pnpm a11y:browser-recheck:json
```

---

## 6. Gerar relatório de testes (documento)

```bash
# Gera docs/test-report.xlsx e docs/test-report.docx
# Requer coverage/coverage-summary.json (rodar pnpm test --coverage antes)
node scripts/generate-test-report.mjs
```

---

## 7. Sequência completa (do zero)

Execute os comandos abaixo em ordem para rodar toda a suíte do zero:

```bash
# 1. Instalar dependências
pnpm install

# 2. Build de todos os pacotes
pnpm build

# 3. Testes unitários com cobertura
pnpm test --coverage

# 4. Build do app Electron
pnpm build:desktop

# 5. Testes E2E
pnpm test:e2e

# 6. Gerar documentos de relatório
node scripts/generate-test-report.mjs
```

---

## 8. Resumo dos scripts disponíveis

| Comando | O que faz |
|---|---|
| `pnpm test` | Todos os testes unitários (Vitest) |
| `pnpm test --coverage` | Testes unitários + cobertura em `coverage/` |
| `pnpm test:watch` | Testes em modo watch |
| `pnpm test:e2e` | Todos os testes E2E Playwright |
| `pnpm test:e2e <arquivo>` | Arquivo E2E específico |
| `pnpm a11y:regression` | Auditoria axe nos livros gerados |
| `pnpm a11y:browser-recheck` | Auditoria axe via browser (color-contrast) |
| `node scripts/generate-test-report.mjs` | Gera `.xlsx` e `.docx` do relatório |
| `npx playwright show-report` | Abre relatório HTML do Playwright |

---

## 9. Arquivos de referência

| Arquivo | Descrição |
|---|---|
| `vitest.config.ts` | Configuração do Vitest (include, coverage, timeout) |
| `playwright.config.ts` | Configuração do Playwright (testDir, workers, reporters) |
| `tests/desktop/setup.ts` | Fixtures compartilhadas dos testes E2E (Electron launcher) |
| `tests/fixtures/raven.pdf` | PDF fixture usado nos testes E2E |
| `coverage/index.html` | Relatório HTML de cobertura (gerado após `--coverage`) |
| `playwright-report/index.html` | Relatório HTML do Playwright (gerado após `test:e2e`) |
| `docs/test-report.xlsx` | Planilha do relatório de testes |
| `docs/test-report.docx` | Documento Word do relatório de testes |
| `docs/TEST-REPORT.md` | Relatório de testes em Markdown |
