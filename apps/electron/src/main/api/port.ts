import { createServer } from "node:net";

type FindFreePortOptions = {
  range?: [number, number];
  random?: boolean;
  maxAttempts?: number;
};

type PortTakenOptions = {
  port: number;
};

function canListenOnPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

async function findFreePort({
  range = [1024, 49151],
  random = true,
  maxAttempts = 5,
}: FindFreePortOptions = {}): Promise<number | undefined> {
  const [start, end] = range;
  const total = end - start + 1;

  if (random) {
    const tried = new Set<number>();
    while (tried.size < Math.min(maxAttempts, total)) {
      const port = start + Math.floor(Math.random() * total);
      if (tried.has(port)) continue;
      tried.add(port);
      if (await canListenOnPort(port)) return port;
    }
    return undefined;
  }

  for (let port = start; port <= end; port++) {
    if (await canListenOnPort(port)) return port;
  }

  return undefined;
}

async function portTaken({ port }: PortTakenOptions): Promise<boolean> {
  return !(await canListenOnPort(port));
}

export { findFreePort, portTaken };