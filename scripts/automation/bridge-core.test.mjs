import { describe, expect, it } from 'vitest'
import { CONVERSATION_URL, createJob, hashPrompt, isAllowedSource } from './bridge-core.mjs'

describe('prompt bridge boundaries', () => {
  it('accepts only the configured conversation', () => {
    expect(isAllowedSource(CONVERSATION_URL)).toBe(true)
    expect(isAllowedSource('https://chatgpt.com/')).toBe(false)
  })

  it('deduplicates equivalent prompt whitespace by hash', () => {
    expect(hashPrompt(' task ')).toBe(hashPrompt('task'))
  })

  it('creates a safe job identity without storing the prompt in its manifest shape', () => {
    const job = createJob('task', CONVERSATION_URL)
    expect(job.id).toHaveLength(16)
    expect(job.status).toBe('queued')
  })
})
