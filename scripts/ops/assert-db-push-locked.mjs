const message = [
  'BLOCKED: Supabase db push is disabled for this repository.',
  'QA and production metadata were repaired under separate dedicated gates,',
  'but legacy history, physical filenames, and a reviewed zero-SQL CLI plan remain unresolved.',
  'Do not run npx supabase db push, migration repair, or history writes.',
  'Read docs/DB_PUSH_LOCK.md and obtain a separate migration-history repair authorization.',
].join('\n')

process.stderr.write(`${message}\n`)
process.exitCode = 1
