import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@wos/shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
      '@wos/db': fileURLToPath(new URL('../../packages/db/src', import.meta.url)),
      '@wos/ui/styles': fileURLToPath(new URL('../../packages/ui/src/styles/globals.css', import.meta.url)),
      '@wos/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
})
