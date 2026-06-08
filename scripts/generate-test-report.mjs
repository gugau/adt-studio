/**
 * Generates docs/test-report.xlsx and docs/test-report.docx
 * from the latest vitest coverage data + hardcoded E2E results.
 *
 * Usage: node scripts/generate-test-report.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ShadingType, convertInchesToTwip, TableLayoutType,
} from 'docx'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const COVERAGE_JSON = path.join(ROOT, 'coverage', 'coverage-summary.json')
const OUT_XLSX = path.join(ROOT, 'docs', 'test-report.xlsx')
const OUT_DOCX = path.join(ROOT, 'docs', 'test-report.docx')
const TODAY = new Date().toLocaleDateString('pt-BR')

// ── Coverage data ─────────────────────────────────────────────────────────────

let coverage = null
if (existsSync(COVERAGE_JSON)) {
  coverage = JSON.parse(readFileSync(COVERAGE_JSON, 'utf8'))
}

const AREAS = [
  { key: 'packages/pdf',      label: 'packages/pdf' },
  { key: 'packages/pipeline', label: 'packages/pipeline' },
  { key: 'packages/types',    label: 'packages/types' },
  { key: 'packages/llm',      label: 'packages/llm' },
  { key: 'packages/storage',  label: 'packages/storage' },
  { key: 'apps/api',          label: 'apps/api' },
  { key: 'apps/studio',       label: 'apps/studio' },
]

function getCoverageByArea() {
  if (!coverage) return []
  return AREAS.map(({ key, label }) => {
    const files = Object.entries(coverage)
      .filter(([f]) => f !== 'total' && f.replace(/\\/g, '/').includes(key))
      .map(([, c]) => c)
    if (!files.length) return { label, stmts: '-', branch: '-', funcs: '-', lines: '-', files: 0 }
    const pct = (k) => {
      const cov = files.reduce((a, f) => a + f[k].covered, 0)
      const tot = files.reduce((a, f) => a + f[k].total, 0)
      return tot === 0 ? 0 : Math.round(cov / tot * 100)
    }
    return { label, stmts: pct('statements'), branch: pct('branches'), funcs: pct('functions'), lines: pct('lines'), files: files.length }
  })
}

function getWorstFiles(limit = 15) {
  if (!coverage) return []
  return Object.entries(coverage)
    .filter(([f]) => f !== 'total')
    .filter(([, c]) => c.lines.total > 20)
    .map(([f, c]) => {
      const norm = f.replace(/\\/g, '/')
      const short = norm.split('/src/').pop() ?? norm
      return { file: short, lines: c.lines.pct, stmts: c.statements.pct, total: c.lines.total }
    })
    .filter(x => x.lines < 30)
    .sort((a, b) => a.lines - b.lines)
    .slice(0, limit)
}

const totalCov = coverage?.total

// ── Static data ───────────────────────────────────────────────────────────────

const UNIT_AREAS = [
  { area: 'packages/pipeline', files: 22, tests: 346, description: 'Todos os 8 estágios do pipeline (extração, sectioning, quizzes, speech, render, tradução, glossário, acessibilidade)' },
  { area: 'packages/llm',      files:  7, tests:  27, description: 'Cache, cliente multi-provider (OpenAI/Anthropic/Gemini), rate limiter, prompts, speech' },
  { area: 'packages/pdf',      files:  5, tests:  82, description: 'Extração de texto e imagem, clipping, spread mode, suporte Sinhala' },
  { area: 'packages/types',    files:  5, tests:  37, description: 'Schemas Zod, book label, pipeline effects, section tree ops' },
  { area: 'packages/storage',  files:  2, tests:  26, description: 'SQLite via WASM, book storage, versionamento de nós' },
  { area: 'apps/api (rotas)',   files: 13, tests: 210, description: 'books, pages, stages, health, glossary, debug, tts, package, adt-preview, reviewer-validation, prompts' },
  { area: 'apps/api (services)',files:  4, tests:  64, description: 'book-service, stage-runner, export-service, page-edit-service' },
  { area: 'apps/studio',        files: 12, tests: 119, description: 'Hooks, lib utils, pipeline components, stage configs, acessibilidade (axe-core)' },
  { area: 'apps/adt-runtime',   files:  2, tests:  13, description: 'Tokenizer de áudio, navegação por teclado' },
]

const E2E_TESTS = [
  { file: 'electron-bridge.spec.ts', tests: 13, passing: 13, skip: 0, description: 'IPC context bridge — window.api, window.electron, process.type, windowControls, updates' },
  { file: 'pipeline.spec.ts',        tests: 17, passing: 17, skip: 0, description: 'Health da API, CRUD de livros, shape do step-status, SPA sem erros JS' },
  { file: 'stage-queue.spec.ts',     tests:  9, passing:  9, skip: 0, description: 'Validação de /stages/run (sem chave, body inválido, livro inexistente), fila, SSE, tasks' },
  { file: 'versioning.spec.ts',      tests:  6, passing:  5, skip: 1, description: 'Histórico de step runs, isolamento entre livros, delete lifecycle, source-pdf info' },
  { file: 'accessibility.spec.ts',   tests:  5, passing:  5, skip: 0, description: 'Auditoria WCAG 2.1 AA via axe-core (home + book detail), Tab reachability, keyboard trap' },
]

const A11Y_TESTS = [
  { tipo: 'Componente (Vitest)', ferramenta: 'axe-core + jsdom', arquivo: 'ToggleCard.a11y.test.tsx', testes: 11, descricao: 'Zero violações axe nos 3 estados; role=switch; aria-checked; Space/Enter; inert no switch decorativo; aria-labelledby/describedby' },
  { tipo: 'Componente (Vitest)', ferramenta: 'axe-core + jsdom', arquivo: 'DeleteBookDialog.a11y.test.tsx', testes: 8, descricao: 'Zero violações axe; role=dialog com nome acessível; Escape fecha; botões focusáveis; estado pending anunciado para AT' },
  { tipo: 'E2E (Playwright)',    ferramenta: 'axe-core + CDP',   arquivo: 'accessibility.spec.ts', testes: 3, descricao: 'Zero violações críticas/sérias WCAG 2.1 AA na home page e página de detalhe do livro' },
  { tipo: 'E2E (Playwright)',    ferramenta: 'Playwright keyboard', arquivo: 'accessibility.spec.ts', testes: 2, descricao: 'Elementos interativos alcançáveis por Tab; ausência de keyboard trap' },
]

// ── XLSX generation ───────────────────────────────────────────────────────────

function colWidth(ws, cols) {
  ws['!cols'] = cols.map(w => ({ wch: w }))
}

function headerStyle() {
  return { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E3A5F' } }, alignment: { horizontal: 'center', wrapText: true } }
}

function applyHeaderStyle(ws, range) {
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c: C })
    if (!ws[addr]) continue
    ws[addr].s = headerStyle()
  }
}

// Sheet 1 — Resumo
function sheetResumo() {
  const totalUnit = UNIT_AREAS.reduce((a, x) => a + x.tests, 0)
  const totalE2E = E2E_TESTS.reduce((a, x) => a + x.tests, 0)

  const data = [
    ['ADT Studio — Relatório de Testes', '', '', '', ''],
    [`Data: ${TODAY}   |   Branch: main   |   Vitest: 4.0.18   |   Playwright: 1.60.0   |   Electron: 41.2.0`, '', '', '', ''],
    [''],
    ['RESULTADO GERAL', '', '', '', ''],
    ['Camada', 'Arquivos', 'Total de Testes', '✅ Passando', '❌ Falhando'],
    ['Unitários (Vitest)', 88, totalUnit, totalUnit - 1, 1],
    ['E2E Desktop (Playwright)', 5, totalE2E, totalE2E - 1, 0],
    ['TOTAL', 93, totalUnit + totalE2E, totalUnit + totalE2E - 1, 1],
    [''],
    ['COBERTURA DE CÓDIGO (v8)', '', '', '', ''],
    ['Métrica', '% Cobertura', 'Linhas Cobertas', 'Total', ''],
    ['Statements', totalCov ? totalCov.statements.pct + '%' : 'N/A', totalCov?.statements.covered, totalCov?.statements.total, ''],
    ['Branches',   totalCov ? totalCov.branches.pct   + '%' : 'N/A', totalCov?.branches.covered,   totalCov?.branches.total,   ''],
    ['Functions',  totalCov ? totalCov.functions.pct  + '%' : 'N/A', totalCov?.functions.covered,  totalCov?.functions.total,  ''],
    ['Lines',      totalCov ? totalCov.lines.pct      + '%' : 'N/A', totalCov?.lines.covered,      totalCov?.lines.total,      ''],
    [''],
    ['TAXA DE SUCESSO GERAL', '99,9%', '', '', ''],
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)
  colWidth(ws, [32, 14, 16, 14, 14])
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
    { s: { r: 9, c: 0 }, e: { r: 9, c: 4 } },
  ]
  return ws
}

// Sheet 2 — Unitários
function sheetUnitarios() {
  const header = ['Área', 'Arq. de Teste', 'Testes', 'Descrição']
  const rows = UNIT_AREAS.map(x => [x.area, x.files, x.tests, x.description])
  const totals = ['TOTAL', UNIT_AREAS.reduce((a,x)=>a+x.files,0), UNIT_AREAS.reduce((a,x)=>a+x.tests,0), '']

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows, [], totals])
  colWidth(ws, [28, 14, 10, 70])
  return ws
}

// Sheet 3 — E2E
function sheetE2E() {
  const header = ['Arquivo', 'Testes', '✅ Passando', '⏭ Skip', 'Descrição']
  const rows = E2E_TESTS.map(x => [x.file, x.tests, x.passing, x.skip, x.description])
  const totals = ['TOTAL',
    E2E_TESTS.reduce((a,x)=>a+x.tests,0),
    E2E_TESTS.reduce((a,x)=>a+x.passing,0),
    E2E_TESTS.reduce((a,x)=>a+x.skip,0),
    '',
  ]

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows, [], totals])
  colWidth(ws, [32, 10, 14, 8, 70])
  return ws
}

// Sheet 4 — Cobertura
function sheetCobertura() {
  const areaData = getCoverageByArea()
  const worst = getWorstFiles()

  const rows = [
    ['COBERTURA POR ÁREA', '', '', '', '', ''],
    ['Área', 'Statements%', 'Branches%', 'Functions%', 'Lines%', 'Arquivos'],
    ...areaData.map(x => [x.label, x.stmts+'%', x.branch+'%', x.funcs+'%', x.lines+'%', x.files]),
    [''],
    ['ARQUIVOS COM MENOR COBERTURA (< 30% linhas, ≥ 20 linhas de código)', '', '', '', '', ''],
    ['Arquivo', 'Lines%', 'Statements%', 'Total de linhas', '', ''],
    ...worst.map(x => [x.file, x.lines+'%', x.stmts+'%', x.total, '', '']),
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  colWidth(ws, [50, 14, 14, 14, 10, 10])
  return ws
}

// Sheet 5 — Acessibilidade
function sheetA11y() {
  const header = ['Tipo', 'Ferramenta', 'Arquivo', 'Testes', 'Descrição']
  const rows = A11Y_TESTS.map(x => [x.tipo, x.ferramenta, x.arquivo, x.testes, x.descricao])

  const bugRows = [
    [],
    ['BUG ENCONTRADO E CORRIGIDO', '', '', '', ''],
    ['Componente', 'ToggleCard', '', '', ''],
    ['Violação', 'WCAG 4.1.2 — Name, Role, Value (serious)', '', '', ''],
    ['Causa', 'Switch decorativo renderizava <button> com aria-hidden + tabIndex=-1. Leitores de tela em modo cursor virtual ainda acessavam o elemento.', '', '', ''],
    ['Correção', 'Adicionado atributo inert no wrapper span, tornando o elemento completamente inacessível a AT, teclado e pointer.', '', '', ''],
  ]

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows, ...bugRows])
  colWidth(ws, [22, 26, 34, 8, 80])
  return ws
}

// Build workbook
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, sheetResumo(),    'Resumo')
XLSX.utils.book_append_sheet(wb, sheetUnitarios(), 'Testes Unitários')
XLSX.utils.book_append_sheet(wb, sheetE2E(),       'Testes E2E')
XLSX.utils.book_append_sheet(wb, sheetCobertura(), 'Cobertura')
XLSX.utils.book_append_sheet(wb, sheetA11y(),      'Acessibilidade')

XLSX.writeFile(wb, OUT_XLSX)
console.log('✓ Gerado:', OUT_XLSX)

// ── DOCX generation ───────────────────────────────────────────────────────────

const BRAND_BLUE = '1E3A5F'
const LIGHT_GRAY = 'F2F4F7'
const MED_GRAY   = 'D0D5DD'

function makeCell(text, opts = {}) {
  const { bold = false, bg = null, center = false, color = '000000' } = opts
  return new TableCell({
    shading: bg ? { type: ShadingType.CLEAR, fill: bg } : undefined,
    children: [new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text ?? ''), bold, color, size: 20 })],
    })],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  })
}

function makeHeaderRow(cols) {
  return new TableRow({
    tableHeader: true,
    children: cols.map(c => makeCell(c, { bold: true, bg: BRAND_BLUE, color: 'FFFFFF', center: true })),
  })
}

function makeTotalRow(cols) {
  return new TableRow({
    children: cols.map(c => makeCell(c, { bold: true, bg: LIGHT_GRAY })),
  })
}

function makeTable(header, rows, totalRow = null, widths = null) {
  const allRows = [
    makeHeaderRow(header),
    ...rows.map((row, i) =>
      new TableRow({
        children: row.map(c => makeCell(c, { bg: i % 2 === 1 ? LIGHT_GRAY : null })),
      })
    ),
  ]
  if (totalRow) allRows.push(makeTotalRow(totalRow))
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: allRows,
  })
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, color: BRAND_BLUE, size: 36 })],
    spacing: { before: 400, after: 200 },
  })
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, color: BRAND_BLUE, size: 28 })],
    spacing: { before: 300, after: 150 },
  })
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, size: 24 })],
    spacing: { before: 200, after: 100 },
  })
}

function para(text, opts = {}) {
  const { bold = false, size = 22, color = '000000', spacing = {} } = opts
  return new Paragraph({
    spacing: { after: 120, ...spacing },
    children: [new TextRun({ text, bold, size, color })],
  })
}

function spacer() {
  return new Paragraph({ children: [new TextRun('')], spacing: { after: 160 } })
}

// ── Unit test area data ──
const unitTotalTests = UNIT_AREAS.reduce((a,x)=>a+x.tests, 0)
const e2eTotalTests  = E2E_TESTS.reduce((a,x)=>a+x.tests, 0)

const areaData = getCoverageByArea()
const worst    = getWorstFiles(10)

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 22 },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top:    convertInchesToTwip(1),
          bottom: convertInchesToTwip(1),
          left:   convertInchesToTwip(1.2),
          right:  convertInchesToTwip(1.2),
        },
      },
    },
    children: [

      // ── Capa ─────────────────────────────────────────────────────────
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1200, after: 400 },
        children: [new TextRun({ text: 'ADT Studio', bold: true, size: 56, color: BRAND_BLUE })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: 'Relatório de Testes e Cobertura', size: 36, color: '444444' })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 },
        children: [new TextRun({ text: `${TODAY}  ·  Branch: main  ·  Vitest 4.0.18  ·  Playwright 1.60.0`, size: 22, color: '666666' })],
      }),

      // ── 1. Resumo Executivo ──────────────────────────────────────────
      h1('1. Resumo Executivo'),
      makeTable(
        ['Camada', 'Arquivos', 'Total', '✅ Passando', '❌ Falhando', '⏭ Skip'],
        [
          ['Unitários (Vitest)', 88, unitTotalTests, unitTotalTests - 1, 1, 0],
          ['E2E Desktop (Playwright)', 5, e2eTotalTests, e2eTotalTests - 1, 0, 1],
        ],
        ['TOTAL', 93, unitTotalTests + e2eTotalTests, unitTotalTests + e2eTotalTests - 1, 1, 1],
      ),
      spacer(),
      para('Taxa de sucesso geral: 99,9%', { bold: true, size: 24, color: '1A7F37' }),

      // ── 2. Testes Unitários ──────────────────────────────────────────
      h1('2. Testes Unitários (Vitest)'),
      h2('2.1 Distribuição por área'),
      makeTable(
        ['Área', 'Arq. Teste', 'Testes', 'O que cobre'],
        UNIT_AREAS.map(x => [x.area, x.files, x.tests, x.description]),
        ['TOTAL', UNIT_AREAS.reduce((a,x)=>a+x.files,0), UNIT_AREAS.reduce((a,x)=>a+x.tests,0), ''],
      ),
      spacer(),
      h2('2.2 Falha conhecida'),
      para('1 teste falha esporadicamente por timeout:', { bold: true }),
      para('package.test.ts › stores accessibility assessment output after packaging'),
      para('Causa: ausência do pacote canvas no jsdom. O HTMLCanvasElement não é implementado no ambiente de teste, causando timeout em ~20% das execuções.'),

      // ── 3. Testes E2E ────────────────────────────────────────────────
      h1('3. Testes E2E Desktop (Playwright)'),
      para('Todos os testes utilizam o app Electron compilado e se conectam via CDP (chromium.connectOverCDP). Cada teste recebe um diretório de dados isolado em tmp/.'),
      spacer(),
      makeTable(
        ['Arquivo', 'Testes', '✅', '⏭', 'O que verifica'],
        E2E_TESTS.map(x => [x.file, x.tests, x.passing, x.skip, x.description]),
        ['TOTAL', E2E_TESTS.reduce((a,x)=>a+x.tests,0), E2E_TESTS.reduce((a,x)=>a+x.passing,0), E2E_TESTS.reduce((a,x)=>a+x.skip,0), ''],
      ),
      spacer(),
      para('O skip em versioning.spec.ts é intencional — requer RAVEN_EXTRACTED_BOOK_DIR no ambiente.', { color: '666666' }),

      // ── 4. Cobertura ─────────────────────────────────────────────────
      h1('4. Cobertura de Código'),
      h2('4.1 Totais'),
      makeTable(
        ['Métrica', '% Cobertura', 'Linhas Cobertas', 'Total de Linhas'],
        [
          ['Statements', totalCov ? totalCov.statements.pct + '%' : 'N/A', totalCov?.statements.covered ?? '-', totalCov?.statements.total ?? '-'],
          ['Branches',   totalCov ? totalCov.branches.pct   + '%' : 'N/A', totalCov?.branches.covered   ?? '-', totalCov?.branches.total   ?? '-'],
          ['Functions',  totalCov ? totalCov.functions.pct  + '%' : 'N/A', totalCov?.functions.covered  ?? '-', totalCov?.functions.total  ?? '-'],
          ['Lines',      totalCov ? totalCov.lines.pct      + '%' : 'N/A', totalCov?.lines.covered      ?? '-', totalCov?.lines.total      ?? '-'],
        ],
      ),
      spacer(),
      h2('4.2 Por área'),
      makeTable(
        ['Área', 'Statements', 'Branches', 'Functions', 'Lines', 'Arquivos'],
        areaData.map(x => [x.label, x.stmts+'%', x.branch+'%', x.funcs+'%', x.lines+'%', x.files]),
      ),
      spacer(),
      h2('4.3 Por que o total (≈30%) parece baixo'),
      para('O apps/studio contém 328 arquivos de componentes React sem testes unitários, dominando o denominador do cálculo. O núcleo funcional do produto (packages/* e apps/api) apresenta cobertura real entre 40% e 78%, mais representativa da qualidade de testes do código de negócio.'),
      spacer(),
      h2('4.4 Arquivos com menor cobertura (< 30% linhas)'),
      makeTable(
        ['Arquivo', 'Lines%', 'Stmts%', 'Total linhas'],
        worst.map(x => [x.file, x.lines+'%', x.stmts+'%', x.total]),
      ),

      // ── 5. Acessibilidade ────────────────────────────────────────────
      h1('5. Testes de Acessibilidade (WCAG 2.1)'),
      para('Em 2026-06 foram adicionados testes automatizados de acessibilidade da interface do Studio usando axe-core, complementando a auditoria já existente para o output gerado (livros em HTML).'),
      spacer(),
      makeTable(
        ['Tipo', 'Ferramenta', 'Arquivo', 'Testes', 'O que verifica'],
        A11Y_TESTS.map(x => [x.tipo, x.ferramenta, x.arquivo, x.testes, x.descricao]),
        ['TOTAL', '', '', A11Y_TESTS.reduce((a,x)=>a+x.testes,0), ''],
      ),
      spacer(),
      h2('5.1 Bug encontrado e corrigido'),
      makeTable(
        ['Campo', 'Detalhe'],
        [
          ['Componente', 'ToggleCard'],
          ['Violação', 'WCAG 4.1.2 — Name, Role, Value (impacto: serious)'],
          ['Causa', 'O switch decorativo renderizava um <button> Radix UI com aria-hidden + tabIndex=-1. Leitores de tela em modo cursor virtual ainda conseguiam acessar o elemento.'],
          ['Correção', 'Adicionado atributo inert no wrapper span. O atributo inert é o padrão HTML moderno que remove completamente um elemento e toda sua subárvore da acessibilidade, teclado e pointer events.'],
        ],
      ),

      // ── 6. Próximos Passos ───────────────────────────────────────────
      h1('6. Próximos Passos Recomendados'),
      makeTable(
        ['Prioridade', 'Área', 'Ação'],
        [
          ['🔴 Alta',   'apps/studio (6% cobertura)', 'Adicionar testes de componente para as páginas principais do pipeline com @testing-library/react + axe'],
          ['🟠 Média',  'packages/llm branches (35%)', 'Exercitar caminhos de fallback: Anthropic, Gemini, retry on rate-limit, cache miss'],
          ['🟠 Média',  'packages/storage (39%)', 'Cobrir edge cases do SQLite: migração de schema, escrita concorrente, datasets grandes'],
          ['🟡 Baixa',  'UI flows E2E', 'Testes que clicam em botões e navegam por rotas do Studio (onboarding, upload de PDF)'],
          ['🟡 Baixa',  'Flaky fix (package.test.ts)', 'Instalar canvas no CI ou mockar HTMLCanvasElement para eliminar timeout esporádico'],
        ],
      ),
      spacer(),
    ],
  }],
})

const buffer = await Packer.toBuffer(doc)
writeFileSync(OUT_DOCX, buffer)
console.log('✓ Gerado:', OUT_DOCX)
