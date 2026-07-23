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
\if :{?suspended_staff_user_id}
\else
  \echo 'BLOCKED: suspended_staff_user_id is required.'
  \quit 1
\endif

-- The abort helper is deliberately temporary and leaves no persistent object.
CREATE OR REPLACE FUNCTION pg_temp.cp2b_abort(message text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CP-2B blocked: %', message;
END;
$$;

SELECT pg_temp.cp2b_abort('production is prohibited')
WHERE :'project_ref' = 'wfxnwfcdjainpojhbdri';
SELECT pg_temp.cp2b_abort('unexpected project ref')
WHERE :'project_ref' <> 'kpvvydthlxupjjqqdpxy';

CREATE TEMP TABLE cp2a_bootstrap_staff (
  user_id uuid PRIMARY KEY,
  staff_role text NOT NULL,
  status text NOT NULL
) ON COMMIT PRESERVE ROWS;

INSERT INTO cp2a_bootstrap_staff (user_id, staff_role, status)
VALUES
  (:'active_staff_user_id'::uuid, 'admin', 'active'),
  (:'suspended_staff_user_id'::uuid, 'operator', 'suspended');

\ir ../../supabase/migrations/20260723160000_client_portal_security_boundary.sql
