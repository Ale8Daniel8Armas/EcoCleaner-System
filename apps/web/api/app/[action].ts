import { createProductionHandler } from '../../server/llm-production.mjs'

export const maxDuration = 60

export default {
  fetch(request: Request) {
    return createProductionHandler(process.env)(request)
  },
}
