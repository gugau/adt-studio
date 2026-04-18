import { spawn } from "node:child_process"
import { findFreePort } from "./find-free-port.mjs"

const apiPort = await findFreePort({ start: 3001 })
if (!apiPort) {
  console.error("[dev] could not find a free port for the API in 3001-49151")
  process.exit(1)
}

const proxyTarget = `http://localhost:${apiPort}`
console.log(`[dev] API port: ${apiPort}`)
console.log(`[dev] Studio proxy target: ${proxyTarget}`)

const child = spawn(
  "pnpm",
  ["--parallel", "--filter", "@adt/api", "--filter", "@adt/studio", "dev"],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      PORT: String(apiPort),
      API_PROXY_TARGET: proxyTarget,
    },
  },
)

const forward = (signal) => () => {
  if (!child.killed) child.kill(signal)
}
process.on("SIGINT", forward("SIGINT"))
process.on("SIGTERM", forward("SIGTERM"))

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
