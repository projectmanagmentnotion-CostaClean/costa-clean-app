import { describe, expect, it } from 'vitest'
import { approvalReason, CONVERSATION_URL, CONVERSATION_URLS, createJob, hashPrompt, isAllowedSource, isUsableCodexOutput, projectForSource, PROJECTS } from './bridge-core.mjs'

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

  it('runs ordinary tasks automatically and gates sensitive tasks', () => {
    expect(approvalReason('fix the mobile spacing and run tests')).toBe('')
    expect(createJob('fix the mobile spacing', CONVERSATION_URL).status).toBe('queued')
    expect(approvalReason('apply the Supabase migration in production')).toBe('production access or deployment')
    expect(createJob('apply the Supabase migration in production', CONVERSATION_URL).status).toBe('awaiting_approval')
  })

  it('rejects empty or placeholder Codex completions', () => {
    expect(isUsableCodexOutput('')).toBe(false)
    expect(isUsableCodexOutput('Codex terminó sin informe.')).toBe(false)
    expect(isUsableCodexOutput('CP-3B.5A.3 FINAL\nEstado: completado con verificación y archivos revisados.')).toBe(true)
  })
})
