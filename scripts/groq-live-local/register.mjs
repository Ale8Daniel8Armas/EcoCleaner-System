import { registerHooks } from 'node:module'

// Los módulos core conservan sus imports TypeScript sin extensión; no se reescriben.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (
        error.code === 'ERR_MODULE_NOT_FOUND' &&
        specifier.startsWith('.') &&
        !/\.[cm]?[jt]s$/.test(specifier)
      ) {
        return nextResolve(`${specifier}.ts`, context)
      }
      throw error
    }
  },
})
