import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertAllowedCommand, assertConversationUrl, EXACT_CONVERSATION_URL, SAFE_COMMANDS, validatePrompt } from './policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const stateDir = path.join(root, '.orchestrator');
const stateFile = path.join(stateDir, 'state.json');
const port = Number(process.env.COSTA_ORCHESTRATOR_PORT || 4179);
const token = process.env.COSTA_ORCHESTRATOR_TOKEN || '';

async function readState() {
  try { return JSON.parse(await fs.readFile(stateFile, 'utf8')); } catch { return { conversationUrl: EXACT_CONVERSATION_URL, status: 'idle', lastProcessedMessageId: null, lastPromptHash: null, validations: [] }; }
}
async function writeState(state) {
  await fs.mkdir(stateDir, { recursive: true });
  const temp = `${stateFile}.tmp`;
  await fs.writeFile(temp, JSON.stringify(state, null, 2));
  await fs.rename(temp, stateFile);
}
function json(res, status, body) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
async function body(req) { let data = ''; for await (const chunk of req) data += chunk; return JSON.parse(data || '{}'); }
function authorized(req) { return !token || req.headers.authorization === `Bearer ${token}`; }
async function runCommand(item) {
  const safe = assertAllowedCommand(item);
  return await new Promise(resolve => {
    const startedAt = new Date().toISOString();
    const child = spawn(safe.command, safe.args, { cwd: root, shell: false, windowsHide: true });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('close', code => resolve({ name: item, code, startedAt, output: output.slice(-20000) }));
  });
}
const server = http.createServer(async (req, res) => {
  try {
    if (!authorized(req)) return json(res, 401, { error: 'unauthorized' });
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, exactConversation: EXACT_CONVERSATION_URL, commands: SAFE_COMMANDS.map(item => item.name) });
    if (req.method === 'GET' && url.pathname === '/state') return json(res, 200, await readState());
    if (req.method === 'GET' && url.pathname === '/report') { const state = await readState(); return json(res, 200, { ...state, approval: 'required before commit, push, Supabase, production or credentials' }); }
    if (req.method === 'POST' && url.pathname === '/events') {
      const event = await body(req); assertConversationUrl(event.conversationUrl);
      const policy = validatePrompt(event.text); const current = await readState();
      const hash = crypto.createHash('sha256').update(`${event.messageId || ''}\n${policy.text}`).digest('hex');
      if (current.lastProcessedMessageId === event.messageId || current.lastPromptHash === hash) return json(res, 200, { accepted: false, duplicate: true, state: current });
      const runId = `${Date.now()}-${hash.slice(0, 12)}`;
      await fs.mkdir(path.join(stateDir, 'inbox'), { recursive: true });
      await fs.writeFile(path.join(stateDir, 'inbox', `${runId}.txt`), policy.text);
      const next = { ...current, conversationUrl: EXACT_CONVERSATION_URL, lastProcessedMessageId: event.messageId || null, lastPromptHash: hash, lastRunId: runId, status: policy.requiresApproval ? 'awaiting_approval' : 'implementation_ready', blockedReasons: policy.blockedReasons, updatedAt: new Date().toISOString(), validations: [] };
      await writeState(next); return json(res, 202, { accepted: true, runId, status: next.status, blockedReasons: policy.blockedReasons, paste: { mode: 'draft-only', send: false } });
    }
    if (req.method === 'POST' && url.pathname === '/validate') {
      const current = await readState(); if (current.status === 'running') return json(res, 409, { error: 'validation already running' });
      await writeState({ ...current, status: 'running' }); const validations = [];
      for (const item of ['test', 'lint', 'build']) { const result = await runCommand(item); validations.push(result); if (result.code !== 0) break; }
      const next = { ...(await readState()), status: validations.every(item => item.code === 0) ? 'awaiting_approval' : 'failed', validations, updatedAt: new Date().toISOString() }; await writeState(next); return json(res, 200, next);
    }
    if (req.method === 'POST' && url.pathname === '/approval') return json(res, 403, { error: 'Approval endpoint records intent only; commit/push and privileged actions remain manual.' });
    return json(res, 404, { error: 'not_found' });
  } catch (error) { return json(res, 400, { error: error.message }); }
});
server.listen(port, '127.0.0.1', () => console.log(`Costa Clean orchestrator listening on http://127.0.0.1:${port}`));
