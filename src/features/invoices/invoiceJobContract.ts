export function resolveInvoiceJobId(originMode: string, jobId: string): string | null {
  return originMode === 'job' && jobId.trim() ? jobId : null
}
