import { cpSync, rmSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const studioDist = resolve(__dirname, '../../studio/dist')
const rendererOut = resolve(__dirname, '../out/renderer')

const apiDist = resolve(__dirname, '../../api/dist')
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

const destModules = resolve(mainOut, 'node_modules')
rmSync(destModules, { recursive: true, force: true })
cpSync(apiRuntimeModules, destModules, { recursive: true })

rmSync(rendererOut, { recursive: true, force: true })
cpSync(studioDist, rendererOut, { recursive: true })

console.log('Copied Studio dist → out/renderer/')
console.log(
  'Copied api bundle + runtime node_modules from api/dist to out/main/:',
  [...apiFiles, 'node_modules/'].join(', '),
)