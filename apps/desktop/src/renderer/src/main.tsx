import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { I18nProvider } from "@lingui/react"
import { i18n } from "./i18n"
import "./styles.css"
import { Splashscreen } from "./splashscreen"

const el = document.getElementById("root")
if (el) {
  createRoot(el).render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <Splashscreen />
      </I18nProvider>
    </StrictMode>,
  )
}
