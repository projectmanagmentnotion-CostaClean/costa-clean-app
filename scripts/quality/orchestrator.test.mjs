import { describe, expect, it } from 'vitest';
import { assertAllowedCommand, assertAllowedPath, assertConversationUrl, validatePrompt } from '../../tools/costa-clean-orchestrator/policy.mjs';

describe('local orchestrator policy', () => {
  it('accepts only the exact conversation', () => {
    expect(() => assertConversationUrl('https://chatgpt.com/g/g-p-694bbc0385b08191b39857e9dfffd1f5/c/6a9930f5-635c-83ed-8178-357662a0c88e?foo=1')).not.toThrow();
    expect(() => assertConversationUrl('https://chatgpt.com/')).toThrow();
  });
  it('blocks privileged or secret-bearing prompts', () => {
    expect(validatePrompt('cambia el color del botón').accepted).toBe(true);
    expect(validatePrompt('haz push y toca Supabase producción').requiresApproval).toBe(true);
  });
  it('allows only the three validation commands', () => {
    expect(assertAllowedCommand('test').args).toEqual(['test']);
    expect(() => assertAllowedCommand('git')).toThrow();
  });
  it('protects sensitive repository paths', () => {
    expect(assertAllowedPath('src/v3/shell/V3ShellChrome.tsx', 'C:/repo')).toContain('src/v3');
    expect(() => assertAllowedPath('supabase/migrations/001.sql', 'C:/repo')).toThrow();
  });
});
