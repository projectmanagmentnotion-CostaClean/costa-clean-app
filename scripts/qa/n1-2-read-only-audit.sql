-- N1.2 production hygiene audit. READ-ONLY: aggregate counts only, no identifiers.
-- A quote may be backed by an existing client OR an existing lead.

with orphan_quotes as (
  select q.id
  from public.quotes q
  left join public.clients c on c.id = q.client_id
  left join public.leads l on l.id = q.lead_id
  left join public.properties p on p.id = q.property_id
  where (
    (q.client_id is not null and c.id is null)
    or (q.lead_id is not null and l.id is null)
    or (q.client_id is null and q.lead_id is null)
  )
  or (q.property_id is not null and q.client_id is not null and p.client_id is distinct from q.client_id)
), relationship_mismatches as (
  select j.id from public.jobs j join public.properties p on p.id = j.property_id
  where p.client_id is distinct from j.client_id
  union
  select j.id from public.jobs j join public.quotes q on q.id = j.quote_id
  where q.client_id is distinct from j.client_id
  union
  select i.id from public.invoices i join public.jobs j on j.id = i.job_id
  where j.client_id is distinct from i.client_id
), financial_link_mismatches as (
  select il.id from public.invoice_lines il
  where il.quantity is null or il.unit_price is null or il.line_subtotal is null
    or abs(il.line_subtotal - il.quantity * il.unit_price) > 0.01
)
select json_build_object(
  'orphan_quotes', (select count(*) from orphan_quotes),
  'relationship_mismatches', (select count(*) from relationship_mismatches),
  'financial_link_mismatches', (select count(*) from financial_link_mismatches),
  'archive_candidates_requiring_action', 0,
  'archive_candidate_policy', 'NO_ACTIONABLE_POLICY_DEFINED'
) as sanitized_n1_2_counts;
