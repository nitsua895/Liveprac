import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves this from https://<user>.github.io/Liveprac/, not the domain root.
  base: command === 'build' ? '/Liveprac/' : '/',
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
    rollupOptions: {
      output: {
        // Stable filenames, not content-hashed. A stale cached index.html (device
        // or CDN edge) would 404 on hashed names that no longer exist and render a
        // blank white page with no way to recover; these paths always exist.
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
}))
