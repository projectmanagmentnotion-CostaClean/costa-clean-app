/// <reference types="vite/client" />

declare const __APP_BUILD_COMMIT__: string
declare const __APP_BUILD_VERSION__: string
declare const __APP_BUILD_DATE__: string

interface ImportMetaEnv {
  readonly VITE_COSTA_CLEAN_VAPID_PUBLIC_KEY?: string
}

interface Window {
  __COSTA_CLEAN_JOB_LINES_DEBUG__?: {
    authMode: 'session' | 'anon'
    attachedPropertyName: 'billing_lines'
    groupedJobIds: string[]
    jobCount: number
    jobLinesError: string | null
    jobLinesFetchStatus: number | null
    jobLinesRawCount: number
    jobLinesRestPath: string
    sampleForJob0052: Array<{
      id?: string
      job_id: string
      sort_order?: number | string | null
      concept: string
      quantity: number | string
      unit: string
      unit_price: number | string
      line_subtotal: number | string
    }>
    sampleJobId: string | null
    sessionError: string | null
  }
}
