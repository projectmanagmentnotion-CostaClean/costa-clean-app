# Costa Clean Prompt Bridge

This is a local, opt-in bridge for one exact ChatGPT conversation. It is not a background Codex task and it does not monitor other tabs.

## Start

From PowerShell:

```powershell
cd C:\Users\USUARIO\costa-clean-app
node scripts/automation/run-prompt-bridge.mjs
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `C:\Users\USUARIO\costa-clean-app\scripts\automation\chrome-extension`.
5. Open only the configured conversation URL and reload it.

The extension accepts prompts only from that exact URL. It sends them to the local bridge, which runs the existing `codex exec` CLI in this repository. When the run completes, the report is inserted into the same conversation composer.

## Safety boundaries

- Binds only to `127.0.0.1`.
- Deduplicates prompts by SHA-256.
- Processes one job at a time.
- Does not print or persist the prompt body in the job manifest.
- Does not commit or push automatically.
- Does not authorize Supabase, production, credential, or destructive operations.
- Private bridge artifacts are stored under `.project-agent/private/prompt-bridge/`, which is ignored by Git.

To inspect jobs without exposing prompt text:

```powershell
Invoke-RestMethod http://127.0.0.1:4319/api/jobs | Select-Object id,status,receivedAt,finishedAt,error
```
