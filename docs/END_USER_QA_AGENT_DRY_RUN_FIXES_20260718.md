# End-User QA Agent Dry-Run Fixes 20260718

## Estado

- Validacion retomada el `2026-07-19` con la app visible.
- `npm run lint`: OK.
- `npm run build`: OK.
- `npm run test`: OK, `32` archivos y `146` tests.
- `write-and-clean`: ejecutado con navegador visible por peticion explicita del usuario.
- Submits confirmados y limpiados: `7` (`3` clientes, `3` inmuebles y `1` presupuesto).
- Residuos QA conocidos: `0`; todos los IDs detectados se archivaron mediante el registro de cleanup.

## Diagnostico inicial

La pasada autenticada contra `https://app.costacleanbcn.com/` mantenia todos los flujos verdes excepto `invoice-create`. La reproduccion manual en el navegador integrado autenticado confirmo que la build publicada sigue bloqueando la ruta `Factura directa` en el paso 1 con:

La marca `?debugBuild=1` identifica la build publicada como `41c43c4` (`2026-07-16-41c43c4`), anterior a los fixes locales todavia no versionados.

`Selecciona o crea un cliente para la factura administrativa.`

Al pulsar `Confirmar origen`, la misma build muestra `No se pudo completar el flujo`. El flujo se descarto despues de la comprobacion y no se guardo ningun dato.

## Build actual local

La build local se genero correctamente y se sirvio en `http://127.0.0.1:4173/`. Chrome y Edge mostraron el mismo bloqueo de entorno antes de auth:

`Error de arranque: Faltan las variables de entorno de Supabase.`

No existe `.env.local` y las variables requeridas no estaban cargadas en el proceso:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

No se inventaron, imprimieron ni versionaron credenciales.

## Fixes del harness

- `qa:flow:agent` respeta ahora `QA_APP_URL` en vez de usar siempre la URL guardada en la metadata de auth.
- El detector de shell rechaza explicitamente la pantalla `Error de arranque` y no debe clasificarla como sesion autenticada.
- El runner mantiene el navegador visible por defecto.
- Los flujos se pueden limitar con `QA_VIEWPORT_IDS` y `QA_FLOW_IDS` para hacer pilotos de escritura pequenos.
- Los formularios controlados esperan la transicion real de React antes de completar el siguiente paso.
- La deteccion de botones ignora controles deshabilitados y copias responsive sin superficie util.

## Resultado de submits visibles

La matriz `write-and-clean` contra produccion confirmo submit y cleanup en movil, tablet y escritorio para:

- `client-create`: `3/3` creados y limpiados.
- `property-create`: `3/3` creados y limpiados.
- `quote-create`: escritorio creado y limpiado; movil y tablet no llegaron al submit.

Los submits revelaron fallos que el dry-run no podia observar:

- `quote-create` en `390x844` y `768x1024` queda en el paso `Inmueble`; el CTA de avance no resulta accesible de forma fiable en la superficie responsive.
- `expense-create` puede volver al listado despues de `Guardar gasto` sin una confirmacion inequívoca ni una entidad QA detectable. No se amplio la matriz de gastos para evitar residuos.
- `invoice-create` sigue bloqueado en la build publicada anterior al fix local.

No se ejecutaron escrituras de factura, cobro, servicio ni cierre fiscal porque no tienen cleanup seguro aprobado y afectan numeracion o datos financieros.

## Resultado y bloqueo

`invoice-create` no puede declararse verde contra una build con el fix en este entorno:

- local esta bloqueado por variables Supabase ausentes;
- produccion sigue sirviendo una build anterior;
- el deploy documentado es Vercel conectado a `main`.

No se hizo commit ni push porque la validacion funcional no esta verde en presupuesto responsive, gasto e invoice, y el gate exige validar la build actual antes del cierre.

## Siguiente validacion exacta

1. Configurar localmente, sin versionar, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, o publicar la build actual mediante el flujo Vercel de `main`.
2. Ejecutar con navegador visible `qa:visual:auth` contra la URL que contenga el fix.
3. Ejecutar `qa:flow:agent --mode=dry-run` contra la misma URL.
4. Confirmar `invoice-create` OK en `390x844`, `768x1024` y `1366x900` antes de commit/push de cierre.
