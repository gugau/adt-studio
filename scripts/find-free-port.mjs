import { createServer } from "node:net"

function canListenOnPort(port) {
  return new Promise((resolve) => {
    const server = createServer()
    server.once("error", () => resolve(false))
    server.once("listening", () => server.close(() => resolve(true)))
    server.listen(port)
  })
}

export async function findFreePort({ start = 3001, end = 49151, maxAttempts = 200 } = {}) {
  const limit = Math.min(maxAttempts, end - start + 1)
  for (let i = 0; i < limit; i++) {
    const port = start + i
    if (await canListenOnPort(port)) return port
  }
  return undefined
}

export async function portTaken(port) {
  return !(await canListenOnPort(port))
}
