\set ON_ERROR_STOP on

-- CP-2B read-only preflight snapshot. Run only after a later exact authorization.
BEGIN TRANSACTION READ ONLY;

SELECT jsonb_build_object(
  'tables', (
    SELECT jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', c.relname, 'owner', r.rolname)
      ORDER BY n.nspname, c.relname)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles r ON r.oid = c.relowner
    WHERE n.nspname IN ('public', 'portal_private', 'storage')
      AND c.relkind IN ('r', 'p', 'v', 'm')
  ),
  'policies', (
    SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname, tablename, policyname)
    FROM pg_policies p
    WHERE schemaname IN ('public', 'portal_private', 'storage')
  ),
  'functions', (
    SELECT jsonb_agg(jsonb_build_object(
      'schema', n.nspname,
      'signature', p.oid::regprocedure::text,
      'owner', r.rolname,
      'securityDefiner', p.prosecdef,
      'acl', p.proacl
    ) ORDER BY p.oid::regprocedure::text)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_roles r ON r.oid = p.proowner
    WHERE n.nspname IN ('public', 'portal_private')
  ),
  'sequences', (
    SELECT jsonb_agg(to_jsonb(s) ORDER BY schemaname, sequencename)
    FROM pg_sequences s WHERE schemaname = 'public'
  ),
  'triggers', (
    SELECT jsonb_agg(jsonb_build_object(
      'table', t.tgrelid::regclass::text,
      'name', t.tgname,
      'definition', pg_get_triggerdef(t.oid)
    ) ORDER BY t.tgrelid::regclass::text, t.tgname)
    FROM pg_trigger t
    WHERE NOT t.tgisinternal
      AND t.tgrelid::regclass::text LIKE 'public.%'
  ),
  'storageBuckets', (
    SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY id), '[]'::jsonb)
    FROM storage.buckets b
  ),
  'rowCounts', (
    SELECT jsonb_object_agg(c.relname, c.reltuples::bigint)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'portal_private') AND c.relkind = 'r'
  )
) AS cp2b_catalog_snapshot;

ROLLBACK;
