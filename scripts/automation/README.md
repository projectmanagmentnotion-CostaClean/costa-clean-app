# Costa Clean Prompt Bridge

This is a local, opt-in bridge for two exact ChatGPT conversations. It is not a background Codex task and it does not monitor other tabs.

## Project isolation

Each conversation is bound to its verified worktree and branch:

| Conversation | Worktree | Branch |
| --- | --- | --- |
| `6a9930f5-635c-83ed-8178-357662a0c88e` | `C:\Users\USUARIO\costa-clean-app-v3` | `codex/app-v3-mobile-first-redesign` |
| `6a9988a6-ddac-83eb-9230-300f27403e6b` | `C:\Users\USUARIO\costa-clean-app` | `codex/ux-operational-mobile-v2` |

The bridge refuses unmapped conversations and never runs a job in the other project's worktree. Jobs are still serialized per process because each worktree may have local uncommitted work that must remain under owner control.

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

The extension accepts prompts only from these exact URLs. If Chrome reports `Failed to fetch` after a bridge restart, use **Reload** on the unpacked extension so its current manifest/content script is active.

- `https://chatgpt.com/g/g-p-694bbc0385b08191b39857e9dfffd1f5/c/6a9930f5-635c-83ed-8178-357662a0c88e`
- `https://chatgpt.com/g/g-p-694bbc0385b08191b39857e9dfffd1f5/c/6a9988a6-ddac-83eb-9230-300f27403e6b`

It sends them to the local bridge, which runs the existing `codex exec` CLI in this repository. Jobs are queued and executed one at a time. When a run completes, the report is inserted into the same conversation composer that originated the prompt.

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
