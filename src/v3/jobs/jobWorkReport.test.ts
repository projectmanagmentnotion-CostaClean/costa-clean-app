import { describe, expect, it } from 'vitest'
import { buildJobWorkReportPdfFileName, getJobWorkReportStatusLabel } from './jobWorkReport'

describe('job work report', () => {
  it('creates a safe operational PDF filename', () => {
    expect(buildJobWorkReportPdfFileName({ id: 'job-1', display_code: 'SRV/2D:001' } as never)).toBe('parte-trabajo-SRV2D001.pdf')
  })

  it('does not use a technical identifier when the display code is missing', () => {
    expect(buildJobWorkReportPdfFileName({ id: '11111111-1111-4111-8111-111111111111', display_code: null } as never)).toBe('parte-trabajo-servicio.pdf')
  })

  it('renders a human-readable status in the operational report', () => {
    expect(getJobWorkReportStatusLabel({ status: 'in_progress' })).toBe('En curso')
  })
})
