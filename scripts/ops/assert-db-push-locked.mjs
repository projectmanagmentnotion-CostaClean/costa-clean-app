const message = [
  'BLOCKED: Supabase db push is disabled for this repository.',
  'QA metadata was repaired under its dedicated gate, but production history remains unreconciled',
  'and no reviewed zero-SQL push plan exists for the repository migration chain.',
  'Do not run npx supabase db push, migration repair, or history writes.',
  'Read docs/DB_PUSH_LOCK.md and obtain a separate migration-history repair authorization.',
].join('\n')

process.stderr.write(`${message}\n`)
process.exitCode = 1
