const message = [
  'BLOCKED: Supabase db push is disabled for this repository.',
  'The live QA and production schemas were updated through reviewed direct psql gates,',
  'but neither database has reconciled supabase_migrations history.',
  'Do not run npx supabase db push, migration repair, or history writes.',
  'Read docs/DB_PUSH_LOCK.md and obtain a separate migration-history repair authorization.',
].join('\n')

process.stderr.write(`${message}\n`)
process.exitCode = 1
