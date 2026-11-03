import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Polyfill WritableStream for MSW SSE in jsdom (vmThreads pool)
if (typeof WritableStream === 'undefined') {
  // @ts-ignore
  const WritableStream = class WritableStream {
    constructor(underlyingSink?: { write?: (chunk: unknown, controller: unknown) => void; close?: () => void; start?: (controller: unknown) => void }) {
      this._sink = underlyingSink
      this._writeQueue: unknown[] = []
      this._closed = false
      if (underlyingSink?.start) underlyingSink.start({})
    }
    get locked() { return this._closed }
    getWriter() {
      let released = false
      const writer = {
        write: (chunk: unknown) => {
          if (released || this._closed) return Promise.reject(new Error('closed'))
          this._writeQueue.push(chunk)
          if (this._sink?.write) this._sink.write(chunk, {})
          return Promise.resolve()
        },
        close: () => {
          released = true
          this._closed = true
          if (this._sink?.close) this._sink.close()
          return Promise.resolve()
        },
        releaseLock: () => { released = true },
      }
      return writer
    }
  }
  // @ts-ignore
  globalThis.WritableStream = WritableStream
}

afterEach(() => {
  cleanup()
})
