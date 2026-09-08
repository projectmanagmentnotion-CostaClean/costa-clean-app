import { describe, expect, it } from 'vitest'
import { buildJobWorkReportPdfFileName } from './jobWorkReport'

describe('job work report', () => {
  it('creates a safe operational PDF filename', () => {
    expect(buildJobWorkReportPdfFileName({ id: 'job-1', display_code: 'SRV/2D:001' } as never)).toBe('parte-trabajo-SRV2D001.pdf')
  })
})
