import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { lingui } from '@lingui/vite-plugin'

export default defineConfig({
  main: {
    build: {
      externalizeDeps: true
    }
  },
  preload: {
    build: {
      externalizeDeps: true
    }
  },
  renderer: {
    plugins: [
      lingui(),
      react({
        babel: {
          plugins: ['@lingui/babel-plugin-lingui-macro']
        }
      }),
      tailwindcss()
    ],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/splashscreen.html')
      },
    },
    server: {
      port: 5174,
    }
  }
})
