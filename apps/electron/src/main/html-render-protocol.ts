import { protocol } from "electron/main";

export const htmlStore = new Map<string, string>();
export function registerHtmlRenderProtocol(): void {
  protocol.handle("html-render", async (request) => {
    const id = new URL(request.url).hostname;
    const html = htmlStore.get(id) ?? `<h1>Not found</h1>`;
    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
  });
}
