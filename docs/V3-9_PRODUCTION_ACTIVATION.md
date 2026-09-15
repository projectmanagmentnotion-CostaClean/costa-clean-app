# V3-9 — Default production V3 activation

Estado: `V3-9 CLOSED / CERTIFIED`
Fecha de certificación: `2026-09-15`

## Alcance y autorización

Este registro cubre Stage-1 y la activación final autorizada de V3 en el proyecto Vercel canónico. V3 queda como comportamiento por defecto; `?v2=1` permanece como escape diagnóstico reversible y `?v3=1` sigue siendo compatible.

- Repositorio: `projectmanagmentnotion-CostaClean/costa-clean-app`
- Rama: `codex/app-v3-mobile-first-redesign`
- Commit fuente certificado: `50bf05a8d11aff8b7b44cc3d79644532803988be`
- Commit de activación: `3bb29fc2cc2e5627561fc1b3d1a8c3ce0b90f680`
- Proyecto Vercel: `costa-clean-app`
- Project ID: `prj_SjR3KtjAoBMhP5foigsyCEmxHojh`
- Team ID: `team_VEreq24eKfIaRjeflStguIw9`
- Dominio de producción: `app.costacleanbcn.com`
- Supabase de producción: `wfxnwfcdjainpojhbdri`
- Supabase QA prohibido en este gate: `kpvvydthlxupjjqqdpxy`

## Incidente de target y cleanup

El intento anterior se detuvo porque el CLI apuntó a un proyecto Vercel no canónico. Ese proyecto accidental fue eliminado antes de reanudar el gate. No se recreó ni se utilizó durante este Stage-1.

La configuración local `.vercel/project.json` quedó enlazada explícitamente al proyecto canónico. No se aplicó de nuevo la migración V3-7A.

## Deployment

- Historical V2 rollback: `dpl_6SKXizLD3wi8qCqTpeTjAYdJAdbF`
- Stage-1 rollback: `dpl_AdTgyDsaKiWSveVreqzMztsPrcEK`
- Final activation: `dpl_BtBXiCoBwfwUFF4ghn5wtUKji4x7`
- URL de deployment: `https://costa-clean-6vmth7x1f.vercel.app`
- Target: `production`
- Estado: `READY`
- Framework: `vite`
- Alias canónico verificado: `app.costacleanbcn.com`
- Commit de deployment: `50bf05a8d11aff8b7b44cc3d79644532803988be`

La identidad del proyecto, el target, el commit y el estado READY fueron verificados después del despliegue. El dominio canónico resolvió a esta deployment.

## Backend y seguridad del smoke

- La configuración de producción se auditó por nombres de variables antes del despliegue y apunta al proyecto Supabase de producción.
- Requests al proyecto QA durante este gate: `0`.
- No se inspeccionaron ni imprimieron credenciales, cookies, JWT, headers de autorización ni secretos.
- No se hicieron writes de negocio, fixtures ni uploads de media en producción.
- Delta de datos de negocio: `0`.
- Fixtures de producción: `0`.
- Uploads de media de producción: `0`.

## Verificación autenticada read-only

La sesión existente se confirmó manualmente y persistió después de reload. La URL normal mostró V3; `?v3=1` siguió mostrando V3 y `?v2=1` mostró V2. Se revisaron en modo lectura:

- Home: `PASS`
- Clients: `PASS`
- Properties: `PASS`
- Quotes: `PASS`
- Services: `PASS`
- Invoices: `PASS`
- Payments: `PASS`
- Expenses: `PASS`
- Leads: `PASS`
- Alerts: `PASS`
- Closings: `PASS` desde `Más → Cierres`
- More/navigation: `PASS`
- Representative workspaces: `PASS`
- Selection mode: `PASS`, cancelado sin mutación
- Back/deep-link navigation: `PASS`
- Hard reload: `PASS`
- Default deep links de cliente y factura: `PASS`
- Back desde deep links: `PASS`
- Client media: `PASS` con fallback/estado existente; no se subió media
- Recurring section: `N/A` si no existe registro recurrente representativo; no se creó ni modificó ninguno

No se ejecutaron altas, ediciones, conversiones, settlements, acknowledgements, cierres ni uploads.

## Presentation and runtime health

- Legacy runtime markers: `0` observados
- Visible UUID: `0`
- Accessible UUID: `0`
- Unicode-as-icon: `0`
- `window.confirm`: `0` en la cobertura certificada
- Duplicate shell: `0`
- Página con error no explicado: `0` observados durante el smoke
- Runtime errors Vercel, últimos 15 minutos: `0`
- Logs 5xx Vercel, últimos 15 minutos: `0`
- Logs 5xx Vercel, últimos 30 minutos post-activation: `0`
- Fallos críticos de deployment: `0`
- Responsive `390x844`: `PASS`, bottom nav y overflow `0`
- Responsive `1280x800`: `PASS`, rail, sin bottom nav y overflow `0`
- Service worker/manifest y hard reload: `PASS`

El navegador controlado no expuso un stream independiente de consola; por ello el resultado de errores se contrasta con el smoke visible y la observabilidad runtime de Vercel, sin afirmar una captura de consola no disponible.

## Quality gates del commit certificado

- `npm test`: `PASS` — `702 passed`, `4 skipped`
- `npm run lint`: `PASS`
- `npm run build`: `PASS`
- `git diff --check`: `PASS`

## Entrega

La activación fue el único cambio de producto de este cierre. Este documento y el roadmap/contrato se versionan después del smoke; no se modificó la configuración de Supabase.

## Verdict

`V3-9 CLOSED / CERTIFIED`

- Production V3 default: `PASS`
- `?v3=1` compatibility: `PASS`
- `?v2=1` fallback: `PASS`
- Rollback readiness: `PASS` — `dpl_AdTgyDsaKiWSveVreqzMztsPrcEK`

V3 queda activa como default en producción. El fallback `?v2=1` es diagnóstico y no se expone como acción de producto.
