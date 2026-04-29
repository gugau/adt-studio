import { cpSync, rmSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const studioDist = resolve(__dirname, '../../studio/dist')
const rendererOut = resolve(__dirname, '../out/renderer')
const rendererAlive = resolve(rendererOut, 'alive')
const tempRenderer = resolve(__dirname, '../out/renderer-temp')

if (!existsSync(studioDist)) {
  console.error('Studio dist not found. Run "pnpm --filter @adt/studio build" first.')
  process.exit(1)
}

cpSync(rendererOut, tempRenderer, { recursive: true })
rmSync(rendererOut, { recursive: true, force: true })
mkdirSync(rendererOut, { recursive: true })
cpSync(studioDist, rendererOut, { recursive: true })
cpSync(tempRenderer, rendererAlive, { recursive: true })
rmSync(tempRenderer, { recursive: true, force: true })

console.log('Copied Studio dist → out/renderer/, electron renderer → out/renderer/alive/')
