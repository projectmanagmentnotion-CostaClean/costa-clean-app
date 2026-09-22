-- The internal app consumes INSERT events only to show staff intake notifications.
-- No public intake surface or write contract is changed by enabling this publication.
DO $$
BEGIN
  IF to_regclass('public.intake_submissions') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'intake_submissions'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.intake_submissions;
  END IF;
END;
$$;
