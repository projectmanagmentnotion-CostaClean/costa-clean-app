# Security RLS Hardening Plan

## Estado

- Documento de plan solamente.
- Este sprint no aplica cambios destructivos ni revocaciones masivas.

## Hallazgos que motivan el plan

- `job_lines`
  - con publishable key devolvio `permission denied`
  - eso puede ser correcto si la lectura real debe requerir sesion autenticada
- RPCs financieras
  - `save_quote_with_lines`
  - `save_invoice_with_lines`
  - `save_job_with_lines`
  - `record_audit_event`
  - no deben quedar abiertas a `anon`
- El entorno actual no permitio auditar grants y policies internas completas desde SQL de sistema.

## Objetivo del siguiente sprint de seguridad

1. Extraer RLS y grants reales desde Supabase SQL Editor.
2. Confirmar que las lecturas internas usan `authenticated` donde toca.
3. Revocar cualquier privilegio sobrante de `anon`.
4. Reprobar RPCs financieras y tablas sensibles con sesion real.

## Consultas recomendadas en Supabase

### RLS por tabla

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

### Policies

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

### Grants

```sql
select
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;
```

## Priorizacion

- `job_lines`
- `invoices`
- `invoice_lines`
- `payments`
- `clients`
- `properties`
- `quotes`
- `jobs`
- `expenses`
- `audit_events`
- `recurring_invoice_plans` cuando exista en real

## Regla operativa mientras tanto

- No abrir RPCs financieras a `anon`.
- No tocar seguridad en este sprint de reconciliacion y control fiscal.
- Mantener los pendientes de recurrentes separados del hardening de permisos.
