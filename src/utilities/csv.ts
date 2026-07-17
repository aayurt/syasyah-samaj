import { parse } from 'csv-parse/sync'

export function parseCSV<T>(text: string): T[] {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
  }) as T[]
}

export function generateCSV(records: Record<string, string>[]): string {
  if (records.length === 0) return ''

  const headers = Object.keys(records[0]!)
  const lines = records.map((r) =>
    headers.map((h) => {
      const str = r[h] ?? ''
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(','),
  )

  return [headers.join(','), ...lines].join('\n')
}
