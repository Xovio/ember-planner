import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Renderer only, in a plain browser (dev preview; basis for a later web/mobile build). */
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  plugins: [react()],
  server: { port: 5199, strictPort: true },
  build: { outDir: resolve(__dirname, 'dist-web'), emptyOutDir: true }
})
