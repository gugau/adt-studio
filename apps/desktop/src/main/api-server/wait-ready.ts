import { type UtilityProcess } from "electron";
import { z } from "zod";

const ApiReadyMessageSchema = z.object({
  type: z.literal("api-ready"),
  port: z.number().int().nonnegative(),
});

export type ApiReadyMessage = z.infer<typeof ApiReadyMessageSchema>;

/**
 * Resolves with the bound port the API server reports via
 * `process.parentPort.postMessage` once it has finished `serve()`-ing.
 * Rejects when the timeout elapses without a valid `api-ready` message.
 */
export function waitForApiReady(
  child: UtilityProcess,
  timeoutMs: number,
): Promise<ApiReadyMessage> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      child.off("message", onMessage);
    };
    const onMessage = (msg: unknown) => {
      const parsed = ApiReadyMessageSchema.safeParse(msg);
      if (!parsed.success) return;
      cleanup();
      resolve(parsed.data);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(`API server did not report ready within ${timeoutMs}ms`),
      );
    }, timeoutMs);
    child.on("message", onMessage);
  });
}
