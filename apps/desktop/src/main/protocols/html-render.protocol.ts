import { protocol } from "electron/main";

const htmlStore = new Map<string, string>();
const HTML_RENDER_SCHEME_PRIVILEGES = {
  scheme: "html-render",
  privileges: { standard: true, secure: true },
} as Electron.CustomScheme;

function registerHtmlRenderProtocol(): void {
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

export { registerHtmlRenderProtocol, HTML_RENDER_SCHEME_PRIVILEGES, htmlStore };
