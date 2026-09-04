import { expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

/**
 * Authenticated JSON API client against the e2e stack. Base URL follows the
 * self-contained web server (E2E_WEB_PORT, default :5174, /api proxied to the
 * e2e API instance). The `request` fixture carries no session, so the client
 * signs itself in lazily (matching the SPA login, Origin = the SPA origin the
 * API's BETTER_AUTH_URL advertises).
 */
const webOrigin = () => `http://localhost:${process.env.E2E_WEB_PORT || 5174}`

export class Api {
  private authed?: Promise<void>

  constructor(
    private readonly request: APIRequestContext,
    public readonly apiBase = webOrigin(),
  ) {}

  private ensureAuth(): Promise<void> {
    if (!this.authed) {
      this.authed = (async () => {
        const res = await this.request.post(`${this.apiBase}/api/auth/sign-in/email`, {
          data: {
            email: process.env.E2E_EMAIL || 'aayurtshrestha@gmail.com',
            password: process.env.E2E_PASSWORD || 'SyashaAdmin2026!',
          },
          headers: { Origin: webOrigin() },
        })
        expect(res.ok(), `Api sign-in ${res.status()}`).toBeTruthy()
      })()
    }
    return this.authed
  }

  async get<T = any>(path: string, query?: Record<string, string | number>): Promise<T> {
    await this.ensureAuth()
    const url = new URL(`${this.apiBase}/api${path}`)
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
      }
    }
    const res = await this.request.get(url.toString())
    expect(res.ok(), `GET ${path} ${res.status()}`).toBeTruthy()
    return res.json() as Promise<T>
  }

  async post<T = any>(path: string, body: unknown): Promise<T> {
    await this.ensureAuth()
    const res = await this.request.post(`${this.apiBase}/api${path}`, { data: body })
    expect(res.ok(), `POST ${path} ${res.status()} ${await res.text().catch(() => '')}`).toBeTruthy()
    return res.json() as Promise<T>
  }

  async patch<T = any>(path: string, body: unknown): Promise<T> {
    await this.ensureAuth()
    const res = await this.request.patch(`${this.apiBase}/api${path}`, { data: body })
    expect(res.ok(), `PATCH ${path} ${res.status()}`).toBeTruthy()
    return res.json() as Promise<T>
  }

  async delete<T = any>(path: string): Promise<T> {
    await this.ensureAuth()
    const res = await this.request.delete(`${this.apiBase}/api${path}`)
    expect(res.ok(), `DELETE ${path} ${res.status()}`).toBeTruthy()
    return res.json() as Promise<T>
  }

  /** Find one doc by an exact field value (bracket where — Payload-safe). */
  async findOne(
    slug: string,
    field: string,
    value: string | number,
  ): Promise<{ id: number | string } & Record<string, any> | null> {
    const res = await this.get<{ docs: any[] }>(`/${slug}`, {
      limit: 1,
      depth: 0,
      [`where[${field}][equals]`]: value,
    })
    return res.docs?.[0] ?? null
  }

  /** Find-or-create pattern used by billing-seed (idempotent per name). */
  async findOrCreate<T extends Record<string, any>>(
    slug: string,
    byName: string,
    body: T,
  ): Promise<T & { id: number }> {
    const existing = await this.findOne(slug, 'name', byName)
    if (existing) return existing as T & { id: number }
    const created = await this.post<T & { id: number }>(`/${slug}`, body)
    return created
  }
}

export type { APIRequestContext }
