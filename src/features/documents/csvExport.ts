export function buildCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const row = (values: Array<string | number | null | undefined>) => values
    .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
    .join(',')

  return `\uFEFF${[row(headers), ...rows.map(row)].join('\n')}`
}
