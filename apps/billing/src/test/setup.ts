import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Polyfill WritableStream for MSW SSE in jsdom (vmThreads pool)
if (typeof WritableStream === 'undefined') {
  globalThis.WritableStream = class WritableStream {
    constructor() {
      this._closed = false
    }
    get locked() {
      return this._closed
    }
    getWriter() {
      let released = false
      return {
        write: () => {
          if (released || this._closed) return Promise.reject(new Error('closed'))
          return Promise.resolve()
        },
        close: () => {
          released = true
          this._closed = true
          return Promise.resolve()
        },
        releaseLock: () => {
          released = true
        },
      }
    }
  }
}

afterEach(() => {
  cleanup()
})
