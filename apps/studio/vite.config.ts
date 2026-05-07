import { lingui } from "@lingui/vite-plugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const isDesktop = mode === "desktop";

  return {
    plugins: [
      lingui(),
      tanstackRouter({
        quoteStyle: "double",
        routeFileIgnorePattern: "\\.test\\.tsx?$",
      }),
      react({
        babel: {
          plugins: ["@lingui/babel-plugin-lingui-macro"],
        },
      }),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5173,
      open: !isDesktop,
      proxy: {
        "/api": {
          target: process.env.API_PROXY_TARGET ?? "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
  }
});
