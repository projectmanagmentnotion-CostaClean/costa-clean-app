begin;

revoke insert, update, delete, truncate on table
  public.jobs,
  public.client_service_requests,
  public.clients,
  public.properties,
  public.invoices,
  public.payments
from authenticated;

commit;
