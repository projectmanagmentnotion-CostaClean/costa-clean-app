-- Enable only internal V3 operational tables for Postgres Changes.
-- This is intentionally additive and idempotent; public intake/portal tables are excluded.
DO $$
DECLARE
  table_name text;
  app_tables text[] := ARRAY[
    'clients', 'properties', 'leads', 'lead_drafts', 'quotes', 'quote_lines',
    'jobs', 'job_lines', 'invoices', 'invoice_lines', 'payments', 'expenses',
    'recurring_invoice_plans', 'quarterly_closings', 'annual_closings'
  ];
BEGIN
  FOREACH table_name IN ARRAY app_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = table_name
       ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END;
$$;
