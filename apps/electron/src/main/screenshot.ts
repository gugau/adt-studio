import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { BrowserWindow } from "electron"

const windows = new Set<InstanceType<typeof BrowserWindow>>()

async function screenshot(
  html: string,
  viewport = { width: 1024, height: 768 }
): Promise<string> {
  const tmpDir = mkdtempSync(join(tmpdir(), "adt-screenshot-"))
  const htmlPath = join(tmpDir, "index.html")
  writeFileSync(htmlPath, html, "utf8")

  const win = new BrowserWindow({
    width: viewport.width,
    height: viewport.height,
    show: false,
    useContentSize: true,
    autoHideMenuBar: true,
    skipTaskbar: true,
    webPreferences: {
      backgroundThrottling: false,
    },
  })

  windows.add(win)
  const wc = win.webContents

  const applyLayout = (w: number, h: number) => {
    win.setContentSize(w, h)
  }

  applyLayout(viewport.width, viewport.height)

  try {
    await wc.loadFile(htmlPath)

    const scroll = (await wc.executeJavaScript(`(async () => {
      await document.fonts.ready
      const el = document.documentElement
      const body = document.body
      const w = Math.max(
        el.scrollWidth,
        body?.scrollWidth ?? 0,
        el.clientWidth
      )
      const h = Math.max(
        el.scrollHeight,
        body?.scrollHeight ?? 0,
        el.clientHeight
      )
      return { scrollW: w, scrollH: h }
    })()`)) as { scrollW: number; scrollH: number }

    const maxDim = 16_384
    const capW = Math.min(Math.max(scroll.scrollW, viewport.width), maxDim)
    const capH = Math.min(Math.max(scroll.scrollH, viewport.height), maxDim)
    if (capW !== viewport.width || capH !== viewport.height) {
      applyLayout(capW, capH)
      await new Promise((r) => setTimeout(r, 50))
    }

    const image = await wc.capturePage()
    return image.toPNG().toString("base64")
  } finally {
    win.destroy()
    windows.delete(win)
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {}
  }
}

async function close(): Promise<void> {
  try {
    for (const win of windows) {
      win.destroy()
    }
    windows.clear()
  } catch {}
}

export { screenshot, close }
