import path from 'node:path';

export const EXACT_CONVERSATION_URL = 'https://chatgpt.com/g/g-p-694bbc0385b08191b39857e9dfffd1f5/c/6a9930f5-635c-83ed-8178-357662a0c88e';
export const SAFE_COMMANDS = [
  { name: 'test', command: 'npm.cmd', args: ['test'] },
  { name: 'lint', command: 'npm.cmd', args: ['run', 'lint'] },
  { name: 'build', command: 'npm.cmd', args: ['run', 'build'] },
];
const blockedPatterns = [
  /production|prod\b|deploy|release/i,
  /supabase|migration|schema|rls|rpc|database|postgres/i,
  /credential|secret|token|cookie|password|api[_ -]?key|\.env/i,
  /git\s+(commit|push)|commit\s+and\s+push/i,
];

export function assertConversationUrl(url, expected = EXACT_CONVERSATION_URL) {
  const normal = value => String(value || '').replace(/[?#].*$/, '').replace(/\/$/, '');
  if (normal(url) !== normal(expected)) throw new Error('Conversation URL is not the configured exact target');
}

export function validatePrompt(text) {
  const value = String(text || '').trim();
  const blocked = blockedPatterns.filter(pattern => pattern.test(value)).map(pattern => pattern.source);
  return { accepted: blocked.length === 0, requiresApproval: blocked.length > 0, blockedReasons: blocked, text: value };
}

export function assertAllowedCommand(name) {
  const command = SAFE_COMMANDS.find(item => item.name === name);
  if (!command) throw new Error(`Command is not allowlisted: ${name}`);
  return command;
}

export function assertAllowedPath(filePath, repoRoot) {
  const relative = path.relative(repoRoot, path.resolve(repoRoot, filePath));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Path is outside repository');
  const normalized = relative.replaceAll('\\', '/');
  const forbidden = /^(?:\.auth|supabase|migrations|production|\.env|credentials)(?:\/|$)/i;
  if (forbidden.test(normalized)) throw new Error(`Path is protected: ${normalized}`);
  return normalized;
}
