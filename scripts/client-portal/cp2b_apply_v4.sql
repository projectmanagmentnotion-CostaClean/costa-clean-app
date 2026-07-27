\set ON_ERROR_STOP on

\if :{?project_ref}
\else
  \echo 'BLOCKED: project_ref is required.'
  \quit 1
\endif
\if :{?active_staff_user_id}
\else
  \echo 'BLOCKED: active_staff_user_id is required.'
  \quit 1
\endif

-- This helper exists only in the current PostgreSQL session.
CREATE OR REPLACE FUNCTION pg_temp.cp2b_v4_abort(message text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CP-2B V4 blocked: %', message;
END;
$$;

SELECT pg_temp.cp2b_v4_abort('production is prohibited')
WHERE :'project_ref' = 'wfxnwfcdjainpojhbdri';
SELECT pg_temp.cp2b_v4_abort('unexpected project ref')
WHERE :'project_ref' <> 'kpvvydthlxupjjqqdpxy';

-- Cast and existence checks intentionally happen before the migration include.
SELECT :'active_staff_user_id'::uuid AS active_staff_user_id
\gset
SELECT pg_temp.cp2b_v4_abort('active staff user does not exist')
WHERE NOT EXISTS (
  SELECT 1
  FROM auth.users
  WHERE id = :'active_staff_user_id'::uuid
);

CREATE TEMP TABLE cp2a_bootstrap_staff (
  user_id uuid PRIMARY KEY,
  role text NOT NULL
) ON COMMIT PRESERVE ROWS;

INSERT INTO cp2a_bootstrap_staff (user_id, role)
VALUES (:'active_staff_user_id'::uuid, 'admin');

\ir ../../supabase/migrations/20260723160000_client_portal_security_boundary.sql
