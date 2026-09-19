import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
  },
  build: {
    // Older iPadOS WebKit can't parse the newest JS syntax; esbuild lowers it.
    // cssTarget stays modern because Tailwind v4's output can't be down-levelled
    // anyway (color-mix/@property have no equivalent).
    target: 'es2019',
    cssTarget: 'chrome111',
  },
})
