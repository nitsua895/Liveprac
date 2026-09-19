import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Netlify sets COMMIT_REF on every build. Stamping it into the page is how we
// tell "the browser is showing a stale deploy" apart from "the current deploy
// is broken" — otherwise both look identical from an iPad with no dev console.
const BUILD_ID = `${(process.env.COMMIT_REF ?? 'local').slice(0, 7)} · ${new Date()
  .toISOString()
  .slice(0, 16)
  .replace('T', ' ')}Z`

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'build-stamp',
      transformIndexHtml(html: string) {
        return html.replaceAll('__BUILD_ID__', BUILD_ID)
      },
    },
  ],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
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
