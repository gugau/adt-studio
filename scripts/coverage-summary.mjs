import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const d = JSON.parse(readFileSync(path.join(__dirname, '../coverage/coverage-summary.json'), 'utf8'))

const areas = {
  'packages/llm':      [],
  'packages/pdf':      [],
  'packages/pipeline': [],
  'packages/storage':  [],
  'packages/types':    [],
  'apps/api':          [],
  'apps/studio':       [],
}

for (const [file, cov] of Object.entries(d)) {
  if (file === 'total') continue
  const norm = file.replace(/\\/g, '/')
  for (const area of Object.keys(areas)) {
    if (norm.includes(area)) { areas[area].push(cov); break }
  }
}

const pct = (files, k) => {
  const cov = files.reduce((a, f) => a + f[k].covered, 0)
  const tot = files.reduce((a, f) => a + f[k].total, 0)
  return tot === 0 ? '   -' : (Math.round(cov / tot * 100) + '%').padStart(4)
}

console.log('Area               | Stmts | Branch | Funcs | Lines | Files')
console.log('-------------------|-------|--------|-------|-------|------')
for (const [area, files] of Object.entries(areas)) {
  if (!files.length) { console.log(area.padEnd(19) + '|     - |      - |     - |     - |     0'); continue }
  console.log(
    area.padEnd(19) + '| ' +
    pct(files, 'statements') + ' | ' +
    pct(files, 'branches').padStart(5) + ' | ' +
    pct(files, 'functions').padStart(4) + ' | ' +
    pct(files, 'lines').padStart(4) + ' | ' +
    String(files.length).padStart(5)
  )
}

const t = d.total
console.log('-------------------|-------|--------|-------|-------|------')
console.log(
  'TOTAL              | ' +
  (t.statements.pct + '%').padStart(4) + ' | ' +
  (t.branches.pct + '%').padStart(5) + ' | ' +
  (t.functions.pct + '%').padStart(4) + ' | ' +
  (t.lines.pct + '%').padStart(4) + ' |'
)
