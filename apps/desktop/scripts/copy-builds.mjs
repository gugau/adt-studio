import { cpSync, rmSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const studioDist = resolve(__dirname, '../../studio/dist')
const rendererOut = resolve(__dirname, '../out/renderer')
const rendererAlive = resolve(rendererOut, 'alive')
const tempRenderer = resolve(__dirname, '../out/renderer-temp')

const apiDist = resolve(__dirname, '../../api/dist-electron')
const mainOut = resolve(__dirname, '../out/main')

const apiFiles = [
  'api-server.mjs',
  'node-sqlite3-wasm.wasm',
  'mupdf-wasm.wasm',
  'index_bg.wasm',
]

const apiServerSource = resolve(apiDist, 'api-server.mjs')
const apiRuntimeModules = resolve(apiDist, 'node_modules')

if (!existsSync(apiServerSource) || !existsSync(studioDist)) {
  console.error('Studio dist not found. Run "pnpm --filter @adt/studio build" first.')
  console.error('api-server.mjs not found. Run "pnpm --filter @adt/api build:server" first.')
  process.exit(1)
}

if (!existsSync(apiRuntimeModules)) {
  console.error(
    'api/dist/node_modules not found. build:server must run install-server-runtime (bundled external deps).',
  )
  process.exit(1)
}

for (const file of apiFiles) {
  const src = resolve(apiDist, file)
  const dest = resolve(mainOut, file)
  rmSync(dest, { force: true })
  cpSync(src, dest)
}


cpSync(rendererOut, tempRenderer, { recursive: true })
rmSync(rendererOut, { recursive: true, force: true })
mkdirSync(rendererOut, { recursive: true })
cpSync(studioDist, rendererOut, { recursive: true })
cpSync(tempRenderer, rendererAlive, { recursive: true })
rmSync(tempRenderer, { recursive: true, force: true })

const destModules = resolve(mainOut, 'node_modules')
rmSync(destModules, { recursive: true, force: true })
cpSync(apiRuntimeModules, destModules, { recursive: true })


console.log('Copied Studio dist → out/renderer/, electron renderer → out/renderer/alive/')
console.log(
  'Copied api bundle + runtime node_modules from api/dist to out/main/:',
  [...apiFiles, 'node_modules/'].join(', '),
)