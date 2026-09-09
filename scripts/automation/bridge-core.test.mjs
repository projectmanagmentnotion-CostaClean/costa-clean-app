import { describe, expect, it } from 'vitest'
import { CONVERSATION_URL, CONVERSATION_URLS, createJob, hashPrompt, isAllowedSource, projectForSource, PROJECTS } from './bridge-core.mjs'

describe('prompt bridge boundaries', () => {
  it('accepts only the configured conversation', () => {
    expect(CONVERSATION_URLS).toHaveLength(2)
    expect(isAllowedSource(CONVERSATION_URLS[0])).toBe(true)
    expect(isAllowedSource(CONVERSATION_URLS[1])).toBe(true)
    expect(isAllowedSource('https://chatgpt.com/')).toBe(false)
  })

  it('deduplicates equivalent prompt whitespace by hash', () => {
    expect(hashPrompt(' task ')).toBe(hashPrompt('task'))
  })

  it('routes each allowed conversation to its isolated project worktree', () => {
    expect(Object.values(PROJECTS)).toHaveLength(2)
    expect(projectForSource(CONVERSATION_URLS[0]).root).toBe('C:\\Users\\USUARIO\\costa-clean-app-v3')
    expect(projectForSource(CONVERSATION_URLS[1]).root).toBe('C:\\Users\\USUARIO\\costa-clean-app')
    expect(projectForSource(CONVERSATION_URLS[0]).branch).not.toBe(projectForSource(CONVERSATION_URLS[1]).branch)
  })

  it('creates a safe job identity without storing the prompt in its manifest shape', () => {
    const job = createJob('task', CONVERSATION_URL)
    expect(job.id).toHaveLength(16)
    expect(job.status).toBe('queued')
  })
})
