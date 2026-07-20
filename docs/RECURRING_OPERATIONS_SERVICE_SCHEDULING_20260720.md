# Recurring Operations And Service Scheduling - 2026-07-20

## Estado inicial

- HEAD inicial: `a846859b975466bb76c635cc59ea243b7825f509`.
- `main` limpio y sincronizado con `origin/main`.
- Baseline: lint OK, build OK y `167/167` tests.
- QA visual autenticada de produccion: `360/360`.
- Produccion se uso solo para lectura, apertura y cancelacion.

## Modulos auditados

- `?view=jobs` en `390x844`, `768x1024` y `1366x900`.
- Alta de servicio desde Jobs.
- Workspace de cliente y alta contextual de servicio.
- Workspace de inmueble y alta contextual de servicio.
- Home y alertas relacionadas con servicios.
- Automatizacion recurrente embebida en cliente.
- Harness visual autenticado y End-User Flow Agent.

## Problemas encontrados

- Jobs ocupaba el primer viewport mobile con KPI, alertas y duplicados repetidos antes de mostrar la agenda.
- La lista abria en `Activos`, mezclando agenda futura e historico, y conservaba esa preferencia legacy.
- Servicios vencidos abiertos no tenian un estado operativo explicito de revision.
- El StepFlow contextual colocaba dos superficies informativas antes del primer control habilitado.
- La automatizacion de facturas podia interpretarse como recurrencia de servicios.
- No existe contrato, tabla ni API de recurrencia de servicios; no es seguro simular ese flow.
- `qa:visual:auth` ignoraba `QA_APP_URL` y podia auditar una URL distinta a la solicitada.

## Cambios aplicados

- Jobs queda aplanado con un header corto, un CTA principal y la agenda inmediatamente despues.
- La vista inicial es `Proximos`, con preferencia versionada para no heredar `Activos`.
- Los estados derivados distinguen `Pendiente`, `Programado`, `En curso`, `Realizado`, `Necesita revision` y `Cancelado`.
- Cliente e inmueble siguen visibles en cada item y sus acciones permanecen compactas.
- El empty state ofrece registrar servicio y explica como revisar historico.
- La recurrencia de servicios se muestra como pendiente de contrato con CTA deshabilitado y razon explicita.
- El copy de cliente identifica la funcionalidad existente como automatizacion de facturas, no de visitas.
- El primer control habilitado del alta contextual queda visible sin tarjetas introductorias redundantes.
- El runner visual respeta la URL efectiva y rechaza errores de arranque.

## Cobertura del agente

- `job-create`: abre el flow, comprueba primer campo y cancela hacia Jobs.
- `service-from-client`: abre workspace, conserva `client`, abre el flow y vuelve al cliente.
- `service-from-property`: abre workspace, conserva `property`, abre el flow y vuelve al inmueble.
- `recurring-section`: verifica seccion y explicacion; registra skip `service-recurring-contract-unavailable`.
- Los 11 flows se recorren en mobile, tablet y desktop.
- Total final: `588/588` checks, `3` skips explicitos y `0` entidades creadas.

## QA visual

- Produccion baseline: `360/360`.
- Build local actual: `360/360` tras un rerun completo.
- Un intento local intermedio agoto 15 segundos al navegar despues de `mobile/jobs`; se clasifico como timing del harness y el rerun completo quedo verde.
- La captura mobile confirma header compacto, filtro inicial `Proximos` y ausencia de las cards KPI/alertas duplicadas.

## Seguridad y deuda restante

- Write-and-clean: no ejecutado.
- Full-submit: no ejecutado.
- Facturas emitidas: `0`.
- Cobros reales: `0`.
- Writes financieros: `0`.
- Residuos QA conocidos: `0`.
- La recurrencia de servicios requiere un sprint de contrato y persistencia separado; schema, SQL, RPC y migrations no se tocaron.
- El sandbox QA desechable/restaurable y `.env.qa.local` siguen pendientes para pruebas reales completas.
