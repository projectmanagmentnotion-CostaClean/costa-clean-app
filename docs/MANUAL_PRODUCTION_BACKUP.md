# Manual production backup

The automated CP51F production backup/restore gate is `DEFERRED_NON_BLOCKING`.
Its historical evidence, consumed run, tag, and markers remain preserved.

## One-time setup

- Install the official Supabase CLI and AGE for Windows.
- Keep the existing AGE private identity outside the repository.
- Set `COSTACLEAN_DB_URL` only for the duration of a backup. Never commit it,
  print it, or place it in a tracked file.

## How to run backup

```powershell
$env:COSTACLEAN_DB_URL = '<temporary database URL>'
powershell -ExecutionPolicy Bypass -File scripts/manual-production-backup.ps1
Remove-Item Env:COSTACLEAN_DB_URL
```

The default destination is `C:\Users\Anderson S\.costaclean-backups`; pass
`-BaseDirectory` to override it. The command creates five SQL dumps, hashes and
manifest metadata, encrypts one AGE archive, deletes plaintext SQL and tar files,
and retains the latest four regular archives.

## How to verify backup

```powershell
powershell -ExecutionPolicy Bypass -File scripts/manual-production-backup-verify.ps1 `
  -BackupFile 'C:\path\CostaClean-PROD-YYYYMMDD-HHMMSS.tar.gz.age' `
  -AgeIdentityPath 'C:\private\age\identity.txt'
```

Verification decrypts only into a temporary directory, validates the archive
sidecar when present, checks required files and hashes, then deletes the temp data.
It does not connect to production.

## When a backup is required

- Production schema migration
- RLS or policy changes
- Destructive SQL
- Bulk `UPDATE` or `DELETE`
- Migration-history repair
- Any other irreversible database operation

## When a backup is not required

- Frontend deployment
- Read-only production inspection
- Code changes
- Tests or documentation
- Local development
- Preparing migrations without applying them

## Retention

Four latest regular encrypted backups are retained. Files containing `MILESTONE`
or `PRE_MIGRATION` are never removed automatically.

No further CP51F production one-shot is required for this manual backup policy.
