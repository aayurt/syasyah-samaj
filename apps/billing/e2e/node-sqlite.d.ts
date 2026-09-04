/**
 * Minimal ambient types for node:sqlite (Node ≥ 22.5).
 * The repo pins @types/node@22.5.4, which predates the built-in sqlite
 * typings — declare only the surface the desktop-storage spec uses.
 */
declare module 'node:sqlite' {
  export interface SqliteStatement {
    run(...params: unknown[]): { changes: number | bigint }
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): Record<string, unknown> | undefined
  }
  export class DatabaseSync {
    constructor(path: string)
    exec(sql: string): void
    prepare(sql: string): SqliteStatement
    close(): void
  }
}
