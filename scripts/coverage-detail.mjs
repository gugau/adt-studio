import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const d = JSON.parse(readFileSync(path.join(__dirname, '../coverage/coverage-summary.json'), 'utf8'))

const backslashRe = /\\/g

// Top uncovered files (< 30% lines, > 20 statement lines)
const worst = Object.entries(d)
  .filter(([f]) => f !== 'total')
  .filter(([, c]) => c.lines.total > 20)
  .map(([f, c]) => {
    const norm = f.replace(backslashRe, '/')
    const short = norm.split('/src/').pop() ?? norm
    return { file: short, lines: c.lines.pct, stmts: c.statements.pct, total: c.lines.total }
  })
  .filter(x => x.lines < 30)
  .sort((a, b) => a.lines - b.lines)
  .slice(0, 12)

console.log('=== FILES WITH LOWEST COVERAGE (< 30% lines, ≥ 20 source lines) ===')
worst.forEach(x =>
  console.log(`  ${String(x.lines + '%').padStart(5)}  ${x.file}  (${x.total} lines)`)
)

// Best covered files > 90%
const best = Object.entries(d)
  .filter(([f]) => f !== 'total')
  .filter(([, c]) => c.lines.total > 20)
  .map(([f, c]) => {
    const norm = f.replace(backslashRe, '/')
    const short = norm.split('/src/').pop() ?? norm
    return { file: short, lines: c.lines.pct, total: c.lines.total }
  })
  .filter(x => x.lines >= 90)
  .sort((a, b) => b.lines - a.lines)
  .slice(0, 10)

console.log('\n=== WELL-COVERED FILES (≥ 90% lines, ≥ 20 source lines) ===')
best.forEach(x =>
  console.log(`  ${String(x.lines + '%').padStart(5)}  ${x.file}  (${x.total} lines)`)
)
