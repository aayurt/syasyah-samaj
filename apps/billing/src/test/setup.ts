import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Polyfill WritableStream for MSW SSE in jsdom (vmThreads pool)
if (typeof WritableStream === 'undefined') {
  // @ts-ignore
  globalThis.WritableStream = class WritableStream {
    constructor() {}
    getWriter() {
      return { write: () => {}, close: () => Promise.resolve(), releaseLock: () => {} }
    }
  }
}

afterEach(() => {
  cleanup()
})
