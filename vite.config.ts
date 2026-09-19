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
}))
