import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const webRoot = fileURLToPath(new URL('../', import.meta.url))
const entry = fileURLToPath(
  new URL('../../../server/llm-production/handler.ts', import.meta.url),
)

await build({
  configFile: false,
  root: webRoot,
  publicDir: false,
  ssr: { noExternal: true },
  build: {
    ssr: entry,
    target: 'node22',
    outDir: 'server',
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
    rolldownOptions: {
      output: { entryFileNames: 'llm-production.mjs' },
    },
  },
})
