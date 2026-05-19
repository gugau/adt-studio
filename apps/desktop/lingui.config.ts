import { defineConfig } from "@lingui/conf"

export default defineConfig({
  locales: ["en", "pt-BR", "es", "fr"],
  sourceLocale: "en",
  catalogs: [
    {
      path: "<rootDir>/src/renderer/src/locales/{locale}",
      include: ["src/renderer"],
      exclude: ["**/locales/**", "**/*.d.ts"],
    },
  ],
  format: "po",
  formatOptions: {
    origins: false,
  },
})
