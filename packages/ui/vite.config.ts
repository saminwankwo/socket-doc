import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Library version (not the documented API's version), injected into the bundle
// for the footer. Read synchronously so it works in the config module itself.
const pkg = JSON.parse(
  readFileSync(new URL('../express/package.json', import.meta.url), 'utf8')
) as { version: string }

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __SOCKETDOCS_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    cssMinify: false,
    minify: 'esbuild'
  }
})
