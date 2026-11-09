/**
 * Minimal fetch-based API client for sequential API checks.
 *
 * Exports createRequest(baseUrl, path, opts) -> Response-like object with
 * .ok, .status, .json(), .text(), .headers().
 */

export function createRequest(baseUrl, path, opts = {}) {
  const url = path.startsWith('http') ? path : `${baseUrl.replace(/\/$/, '')}${path}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  return fetch(url, {
    ...opts,
    signal: controller.signal,
  })
    .then((res) => {
      clearTimeout(timeout)
      return res
    })
    .catch((err) => {
      clearTimeout(timeout)
      const e = new Error(`Request failed: ${err.message}`)
      e.code = 'REQUEST_FAILED'
      throw e
    })
}
