# Risk Map

| Area | Riesgo | Severidad | Archivos sensibles | Que no tocar sin permiso explicito | Mitigacion recomendada |
| --- | --- | --- | --- | --- | --- |
| Supabase read layer | `appDataApi` ya usa fallbacks por drift de esquema y compatibilidad legacy. Cambios superficiales pueden ocultar problemas reales de despliegue. | alta | `src/app/appDataApi.ts`, `src/lib/supabaseRest.ts`, `src/lib/supabase.ts`, `src/app/dataHealth.ts` | Queries REST, rutas de lectura, manejo de errores, fallback de columnas, cliente Supabase | Mantener auditoria separada de cualquier rediseño; validar siempre contra schema real antes de tocar lecturas |
| Auth | Bootstrap y sesion viven en `App.tsx` + `supabase.ts`; el acceso publico aislado depende de ese orden exacto. | alta | `src/App.tsx`, `src/features/auth/AuthPage.tsx`, `src/lib/supabase.ts`, `src/app/publicStandaloneRoutes.ts` | Orden de bootstrap, manejo de sesion, paths publicos, guardas previas al shell | No tocar en sprints visuales; cualquier cambio requiere sprint propio de acceso |
| Facturas | Sprint 8 mejora la jerarquia visual del workspace, pero la zona sigue siendo critica: conviven cobro, emision, numeracion, control fiscal, documento y acciones bulk sobre el mismo dominio sensible. | critica | `src/pages/InvoicesPage.tsx`, `src/features/invoices/*`, `src/features/financial/financialWriteApi.ts` | Writes de factura, detalle, sync de pagos, control fiscal, bulk actions, migracion nueva de StepFlow sobre el workspace | Mantener los cambios en capa visual solamente; cualquier simplificacion mayor requiere pruebas dedicadas y aislamiento previo del write path |
| Numeracion de facturas | Historial reciente de endurecimiento SQL y regularizaciones. El cliente ya valida mismatch, pero la integridad final depende de DB y RPC. | critica | `src/features/invoices/invoiceNumbering.ts`, `src/features/invoices/invoiceWriteTrace.ts`, `src/features/financial/financialWriteApi.ts`, `sql/20260702_*invoice*` | RPC de guardado, triggers/SQL de numeracion, display code, invoice number, metadata esperada | No tocar sin sprint especifico de numeracion y validacion DB |
| Presupuestos | Sprint 7 moderniza create/edit y la lectura documental sobre el StepFlow oficial, pero conversion comercial y handoff a servicios/facturas siguen cruzando varios modulos y prefills sensibles. | alta | `src/pages/QuotesPage.tsx`, `src/features/quotes/*`, `src/features/financial/financialWriteApi.ts`, `src/features/jobs/jobCreatePrefill.ts` | Reglas de aceptacion, conversion, prefills, save path, salida documental y lectura comercial de importes | Mantener la capa visual y documental separada del dominio; no tocar aceptacion, conversion ni write path sin sprint dedicado |
| Clientes | Alta, datos fiscales, recurrentes y workspace confluyen en un solo dominio con relaciones amplias. | alta | `src/pages/ClientsPage.tsx`, `src/features/clients/*`, `src/features/recurringInvoices/*` | Escrituras fiscales, fusion de clientes, navegacion de workspace, planes recurrentes | Tratar onboarding y workspace por separado, conservando `clientWriteApi` |
| Propiedades | El REST/RPC directo ya exige `session.access_token`, pero la reasignacion y el PATCH siguen dependiendo de RLS y contratos relacionales sensibles. | alta | `src/pages/PropertiesPage.tsx`, `src/features/properties/PropertyWorkspace.tsx`, `src/features/properties/PropertyDetailCard.tsx`, `src/lib/authenticatedSupabaseWrite.ts` | Reasignacion de cliente, payloads, RPC, policies o contratos del detalle editable | Conservar el helper autenticado, abortar sin sesion y validar cualquier cambio futuro en sandbox sin ampliar a dominios financieros |
| Servicios | El dominio ya usa `job_lines` y fallback legacy. Sprint 10 mejora solo la jerarquia visual, pero el detalle editable y la base de cobro siguen sensibles: cambios ingenuos pueden romper lectura, billing summary o permisos. | alta | `src/features/jobs/*`, `src/app/appDataApi.ts`, `sql/20260629_create_job_lines_and_save_job_with_lines.sql`, `sql/20260701_*job_lines*` | `job_lines`, `jobWriteApi`, billing lines, fallback legacy, permisos de lectura, edicion profunda del servicio | No tocar sin revalidar DB y RLS; mantener el alta sobre StepFlow oficial y separar UX de persistence model |
| Finanzas | Cobros, gastos, cierre fiscal e inteligencia fiscal se encadenan. Sprint 11 pule solo la jerarquia visual y los estados base; el riesgo sigue siendo malinterpretar estados no definitivos o tocar write paths sensibles al intentar simplificar mas. | alta | `src/features/payments/*`, `src/features/expenses/*`, `src/pages/FiscalClosingPage.tsx`, `src/features/closing/*`, `src/features/financial/financialWriteApi.ts` | Estados financieros derivados, exportacion fiscal, etiquetas de verdad contable, IA fiscal, write paths de cobro/gasto | Mantener lenguaje prudente y pruebas de no regresion; no vender certeza que el sistema no garantiza ni mezclar UX con cambios de persistencia |
| Formularios publicos / intake | Sprint 6 migra la capa visual al `FullscreenStepFlow` oficial, pero el intake sigue siendo publico y conectado a un pipeline legacy + `lead_drafts`. Cambios de forma o validacion pueden afectar captacion, normalizacion o compatibilidad de importacion. | alta | `src/pages/PublicQuoteRequestPage.tsx`, `src/features/publicIntake/*`, `api/public-quote-request.js`, `api/tools/imports/*` | Payload normalizado, validacion, mapping de Google Forms, pipeline de borradores, contratos de `lead_drafts` | Mantener futuras mejoras en la capa visual o en validacion por sprint separado; no tocar pipeline ni compatibilidad CSV/Google Forms sin auditoria especifica |
| Sistema global de listas | Sprint 9A centraliza busqueda/filtros/orden en una capa compartida. El riesgo no es de persistencia, sino de introducir divergencia otra vez si modulos futuros crean controles ad hoc fuera de `DSListControlBar` o `ListToolbar`. | media | `src/design-system/components/DSListControlBar.tsx`, `src/components/ListToolbar.tsx`, `src/features/lists/*` | Filtros backend, cambios de contratos, toolbars paralelas, persistencia de negocio disfrazada de preferencia local | Mantener esta capa como patron unico y limitarla a estado local; cualquier filtro con impacto de negocio debe ir a sprint propio |
| Motion / GSAP | Una adopcion descontrolada de motion puede degradar accesibilidad, rendimiento o claridad del dato, especialmente en modulos densos o criticos. | media | `src/design-system/motion/*`, `src/design-system/index.ts`, futuros componentes que adopten GSAP | Imports directos de `gsap` en negocio, timelines largas, `ScrollTrigger` global, stagger masivo, motion sobre importes, warnings o estados fiscales | Encapsular GSAP en la capa motion, respetar reduced motion, exigir cleanup y adoptar por fases desde primitives seguras |
| Smart suggestions locales | Sugerencias de CP/city o conceptos mal gobernadas pueden introducir falsa confianza, autocompletados incorrectos o persistencia silenciosa de valores no revisados. | media | `src/design-system/components/DSSmartPostalCodeInput.tsx`, `src/design-system/components/DSConceptAutocomplete.tsx`, `src/features/concepts/useRecentConceptSuggestions.ts`, `src/features/locations/postalCodeSuggestions.ts` | Autocompletado automatico no confirmado, ampliacion sin auditoria del dataset local, guardado de valores sensibles en memoria local | Mantener sugerencias como ayuda opt-in, filtrar valores sensibles, ampliar dataset solo con evidencia operativa y no mezclarlo con reglas de validacion o persistencia |
| Accesibilidad / responsive QA | Parte del shell autenticado y varios workspaces solo pudieron auditarse por codigo en este sprint porque la verificacion visual completa requiere sesion real y no se podia tocar auth. | media | `src/app/AppShell.tsx`, `src/app/AppNav.tsx`, `src/pages/*`, `src/features/*`, `src/design-system/components/*` | Auth, accesos de sesion, atajos de QA que alteren el runtime, cambios funcionales encubiertos como polish visual | Mantener el hardening en primitives compartidas y programar una pasada autenticada especifica de teclado/lector de pantalla antes del cierre final del roadmap |
| Alertas y dashboard | Mucha decision operativa depende de agregados y quick actions centralizados. Un rediseño superficial puede degradar prioridad real. | media | `src/pages/HomePage.tsx`, `src/pages/AlertsCenterPage.tsx`, `src/features/dashboard/*`, `src/features/automation/*` | Mapeo de incidentes, quick views, alert presentation, actions cross-module | Partir del criterio actual y compactar, no reimaginar sin auditoria |
| Shell central | `AppShell.tsx` concentra wiring, prefills, filtros, alertas y navegacion. Cualquier toque tiene radio de impacto amplio y el shell sigue dependiendo de aliases visuales (`fiscal_closing` frente a `annual_closing` y `quarterly_closing`) sobre `?view=`. | alta | `src/app/AppShell.tsx`, `src/app/useShellNavigation.ts`, `src/app/AppShellViewRenderer.tsx`, `src/app/AppNav.tsx`, `src/app/navigation.ts` | Orquestacion cross-module, prefills, filtros, guardas de navegacion, cambio del mecanismo `?view=` o de aliases vivos | Reducir presion sobre este archivo via patrones visuales y documentacion; cualquier refactor del router interno requiere sprint tecnico separado |
| Densidad visual mobile | La app puede reintroducir wrappers, cards anidadas y toolbars demasiado pesadas cuando un modulo crece sin un gate explicito de densidad. | media | `src/features/invoices/*`, `src/features/clients/*`, `src/features/properties/*`, `src/features/jobs/*`, `src/design-system/components/DSListControlBar.tsx`, `src/components/ActionGroup.tsx` | Nuevas cards secundarias abiertas por defecto, filtros permanentes demasiado altos, paneles debug visibles en flujo normal, acciones secundarias compitiendo por ancho | Mantener el gate `one surface = one layer`, esconder debug fuera del flujo normal y validar mobile/iPad con captura real en sprints visuales |
| Loading mobile | El loading compartido puede volver a crecer y crear flashes de cards falsas, `0` placeholders o empty states prematuros si los estados no se separan bien. | media | `src/app/AppShellViewRenderer.tsx`, `src/design-system/components/DSPageLoading.tsx`, `src/components/DeferredContentFallback.tsx`, `src/design-system/components/DSEmptyState.tsx` | Reutilizar `empty-state` gigante como loading, mostrar KPIs `0` antes de tiempo, renderizar mas de `3` skeleton rows en mobile | Mantener primitive compartida compacta, retrasar loading expandido en transiciones cortas y repetir QA autenticada en `390x844` y `768x1024` |
| QA autenticada embebida | La sesion autenticada del navegador embebido sigue siendo intermitente: resuelve metadata del tab pero puede agotar `60000-120000 ms` al navegar o capturar, dejando sprints visuales parcialmente bloqueados. | media | navegador embebido de Codex, app local en `127.0.0.1:4173`, docs QA vivas | Declarar QA completa sin evidencia real, inventar screenshots, asumir fallback de `storageState` inexistente | Documentar timeout exacto, reintentar con alcance corto y mantener fallback solo si existe una sesion autenticada reutilizable real |
| Legacy views y backups | Hay paginas legacy no montadas y backups `.bak-*` en `src/pages/`. | media | `src/pages/AnnualClosingPage.tsx`, `src/pages/QuarterlyClosingPage.tsx`, `src/pages/*.bak-*` | Borrar o mover sin auditoria, tocar archivo equivocado por confusion | Registrar y tratar en sprint tecnico de higiene, separado del rediseño |

## Riesgos nuevos de Motion Phase 2

- `Home` ya usa charts SVG y reveals sutiles; cualquier extension futura debe mantener dato real, CTA clara y fallback seguro sin convertir Inicio en una landing decorativa.
- `ScrollTrigger` queda limitado a reveals `once` del dashboard; no debe expandirse a listas densas, shell global ni dominios criticos sin sprint separado.

## Riesgos nuevos de Motion Phase 3

- `FullscreenStepFlow` ya admite transicion GSAP compartida; cualquier ampliacion futura debe seguir animando la superficie y no los campos de formulario de forma individual o repetitiva.
- `ActionFlowOverlay` y `ConfirmDialog` ya tienen entrada comun; no deben recibir timelines mas largas ni cierres retrasados que bloqueen la accion del usuario.
- La compactacion de copy no puede suavizar warnings fiscales, mismatch o estados bloqueados en facturas.

## Riesgos nuevos de Motion Phase 4

- `Home` ya es mas visual y compacto; cualquier ampliacion futura debe seguir el criterio de una sola decision clara y no reintroducir bloques densos o charts decorativos.
- Las sugerencias locales de formularios son una ayuda de velocidad, no una fuente autoritativa de datos ni un sustituto de validacion de negocio.

## Riesgos nuevos de Motion Phase 5

- el acknowledgement local de alertas solo reduce ruido en `Home`; no debe confundirse con un workflow real de resolucion o revision
- el cliente sigue guardando `billing_address` como string unico; la separacion visual de ubicacion no debe interpretarse como cambio de modelo

## Riesgo nuevo de Mobile First Reset

- la compactacion iPhone debe quedarse en jerarquia, densidad y colapso; si una futura pasada intenta mezclarla con cambios de write path o reglas de negocio, el riesgo vuelve a ser alto de forma inmediata

## Riesgo nuevo de QA visual autenticada iPhone 390x844

- la pasada autenticada confirma que los mayores fallos residuales eran visuales en shell movil y StepFlow; no debe usarse este resultado para justificar cambios de dominio fuera de CSS/estructura
- el viewport principal validado fue `390x844`; cualquier afirmacion sobre `375x812` o `430x932` sigue siendo de cobertura parcial mientras no exista pasada dedicada

## Riesgo nuevo de shell tablet overflow

- un cambio pequeno en `cc-shell-nav` puede romper todos los modulos en `768x1024` aunque la logica de negocio siga intacta
- el shell superior debe tratarse como superficie critica de QA visual compartida en cualquier sprint mobile/iPad
- nunca asumir que tablet queda cubierta solo porque mobile estrecho ya no desborda

## Test Debt Closed - Invoice Fiscal Debug Visibility

- La deuda de test ya no esta en producto sino en cobertura: un test viejo esperaba una superficie fiscal retirada del flujo normal.
- El riesgo futuro es reintroducir asserts de debug en vistas operativas y convertir la suite en freno falso positivo.

## Authenticated QA Recovery Attempt

- El intento del `2026-07-08` recupero resolucion del tab autenticado, pero no la navegacion/captura estable del navegador embebido.
- Mientras ese canal siga inestable, cualquier cierre visual autenticado debe declararse parcial aunque lint/build/test queden verdes.

## Riesgo nuevo de QA harness local

- el harness local reduce dependencia del navegador embebido, pero introduce riesgo de exponer datos reales si el perfil QA, screenshots o reportes privados se versionan por error
- la mitigacion obligatoria es mantener `.auth/`, `qa-screenshots/private/` y `qa-reports/private/` fuera de git y no imprimir secretos
- cuando un check visual dependa de una cifra concreta, usar `data-qa` estable reduce falsos negativos sin relajar el gate
- cuando un flow no tenga ruta standalone real, no se debe inventar un escenario de modulo; se documenta como embebido o no aplicable

## Riesgo nuevo de alta embebida de propiedades

- `PropertyCreateFlow` y `PropertyCreateForm` siguen escribiendo por REST directo desde cliente; cualquier mejora de UX debe quedarse en sincronizacion local, duplicate guard y feedback, no en redisenar el write path sin sprint dedicado.
- Cuando el refresh tras el alta falla, el riesgo principal pasa a ser de falsa sensacion de exito; la mitigacion minima es inyeccion local de la opcion creada, mensaje visible y reintento explicito.

## Riesgo nuevo de baseline QA autenticada roto y recuperado

- La caida de `360/360` a `338/360` y el rerun local aun peor del `2026-07-16` muestran que el mayor riesgo ya no es ausencia de harness, sino que sus heuristicas de carga se desalineen del shell real y produzcan falsos negativos en cadena.
- La mitigacion valida no es bajar cobertura: es endurecer readiness del shell, manejar paginas internas de error del navegador y usar markers estables en create flows.
- El cierre recuperado a `360/360` deja este riesgo controlado, pero no eliminado; cualquier cambio futuro en loadings del shell o en cabeceras de StepFlow debe revalidarse con el harness autenticado.
- Referencia: [QA_BASELINE_RECOVERY_20260716.md](C:/Users/USUARIO/costa-clean-app/docs/QA_BASELINE_RECOVERY_20260716.md)

## Riesgos nuevos de One-Line Filters + Invoice 2026-045

- el patron `one-line filters` depende de que cada modulo ordene bien su primer grupo de filtros; una mala configuracion puede hacer que los chips rapidos no sean los mas utiles
- `AnnualClosingPage` y `QuarterlyClosingPage` mantienen filtros legacy fuera de `ListToolbar`; no asumir homogeneidad total en todo el repo
- la 2026-045 sigue pendiente porque no existe soporte explicito de rectificativa; usar la edicion mayor de una emitida sin validacion fiscal puede ser un riesgo operativo real

## Riesgos nuevos de Invoice 2026-045 Safe Correction Flow

- el borrador guiado reutiliza `InvoiceCreateFlow`, pero no certifica por si solo que el cierre fiscal correcto no requiera rectificativa
- la card de correccion esta acotada al caso auditado `2026-045`; si aparecen mas casos, conviene mover la configuracion a un registro controlado y no replicar logica ad hoc
- la correccion interna del mismo registro ya tiene rama UI separada, pero el write real sigue dependiendo de sesion o credencial autorizada; sin eso no hay aplicacion efectiva

## Riesgos nuevos de Same-Number RPC Update Fix

- la migracion nueva protege el caso de update con mismo numero en la misma anualidad, pero si se ampliara sin criterio podria relajar de forma accidental la emision de facturas nuevas
- el repo ya tiene la migracion creada, pero mientras no se aplique en Supabase real la factura `2026-045` sigue parcial y no debe enviarse
- el fallback directo por sesion autenticada sigue sin permiso para actualizar `public.invoices`; incluso con el bug de hueco resuelto, una base real con policies distintas puede requerir una via de servidor autorizada

## Riesgos especiales que merecen sprint separado

- Numeracion de facturas
- Hardening Supabase / RLS / RPC
- Cualquier write path de facturas
- Cualquier cambio de auth
- Cualquier cambio que mezcle UX con regularizaciones SQL

## Lectura final de cierre

- La base UX del roadmap queda cerrada.
- El riesgo principal ya no es visual; es tecnico-operativo en dominios sensibles.
- La siguiente fase no debe reabrir un rediseño general, sino atacar riesgos concretos con pruebas y alcance aislado.

## Riesgos nuevos del End-User Flow Agent

- El runner dry-run reduce el riesgo de data basura, pero una allowlist demasiado amplia podria pulsar un CTA ambiguo en el futuro; esa lista debe mantenerse corta y revisable.
- La autenticacion sigue dependiendo de una sesion manual local; si expira, el fallo debe clasificarse como problema de entorno o harness, no como regresion UX inventada.
- Algunos flujos embebidos pueden requerir contexto previo para abrirse sin escribir datos reales; esos casos deben reportarse como `skipped` o `not applicable`, nunca como exito fabricado.
- El modo `write-and-clean` introduce un riesgo nuevo: si el selector de lookup por `qaRunId` o el payload de cleanup deriva, podria dejar entidades reales vivas o tocar la fila equivocada. La mitigacion obligatoria es mantener un registro por flujo, markers unicos y reportes privados de cleanup revisables.

## Riesgo de URL y build incorrectas en QA

- Si el runner ignora `QA_APP_URL`, una pasada etiquetada como local puede auditar produccion y producir evidencia invalida.
- Si el detector de shell acepta una pantalla de arranque, el agente puede generar falsos resultados en cadena sobre una app que nunca cargo.
- Mitigacion aplicada: URL efectiva unica en runner, rechazo de marcadores de error de arranque y reporte honesto del bloqueo por variables.
- Riesgo residual: produccion sigue en una build anterior; no validar `invoice-create` hasta que la URL auditada sirva el fix actual.

## Riesgos de Submit y Cleanup - 2026-07-19

- Un overlay con footer propio alrededor de un StepFlow con footer operativo puede ocultar el CTA en mobile/tablet sin romper el estado del formulario.
- Descartar el id devuelto por una insercion y cerrar inmediatamente puede convertir una escritura real en un resultado imposible de auditar o limpiar con certeza.
- Un HTTP exitoso con cero filas afectadas no demuestra cleanup; el registro debe rechazarlo.
- Los runners especializados no pueden eludir la politica central de write-and-clean.
- Hasta desplegar la fuente actual, repetir quote/expense submit contra produccion solo reproduce la build anterior y no valida la correccion.

## Riesgos del QA Sandbox Blueprint - 2026-07-20

- Una URL localhost no demuestra aislamiento: puede servir una build local conectada a Supabase productivo.
- Un valor manual `QA_ENV=sandbox` tampoco basta; debe coincidir el fingerprint del proyecto Supabase.
- Archivar documentos numerados no restaura secuencias ni elimina relaciones o side effects.
- El reset total requiere snapshot o rama desechable del sandbox; SQL manual y renumeracion productiva siguen prohibidos.
- Los wrappers preparados no habilitan full-submit; hacerlo antes de provisionar sandbox, seed, baseline y restore proof seria un bypass de seguridad.

## Riesgos de recurrencia y agenda - 2026-07-20

- Confundir `recurring_invoice_plans` con recurrencia de servicios puede emitir documentos sin representar visitas reales.
- La mitigacion actual es copy explicito, CTA de servicio recurrente deshabilitado y skip estable en dry-run.
- Los flows desde cliente e inmueble dependen de conservar sus query params; el agente los valida antes, durante y despues de cancelar.
- Una preferencia legacy de lista puede ocultar la agenda proxima; Jobs usa una clave versionada con `Proximos` como lectura inicial.

## Riesgos de provisionamiento full-flow sandbox - 2026-07-21

- El repo tiene muchos SQL historicos fuera de `supabase/migrations`; aplicar esa carpeta completa a un QA nuevo podria ejecutar regularizaciones obsoletas o dependientes de datos productivos.
- Una branch Supabase puede quedar aislada pero incompleta si la historia de migraciones no reproduce el schema vivo; debe verificarse antes de auth o seed.
- Un proyecto separado sin snapshot/branch baseline no demuestra restaurabilidad aunque acepte writes.
- Clonar backups puede copiar datos y auth productivos y puede implicar coste; no es una via autorizada para seed sintetico sin decision expresa del propietario.
- `.env.local` contiene superficie privada y no puede reutilizarse como `.env.qa.local`; el checker solo compara el fingerprint publico en memoria y nunca imprime valores.
- El target QA aislado ya pasa fingerprint y auth, pero su REST schema cache no contiene las tablas principales. Un pase estructural del runner visual no demuestra readiness de datos si las capturas muestran errores REST.
- El dry-run queda bloqueado en `489/510`; aplicar SQL historico para completar el schema sin revision sigue fuera de alcance y podria reproducir contratos obsoletos.
- La auditoria de bootstrap confirma que faltan `CREATE TABLE` para las ocho tablas base principales y que varias RPC financieras tienen reemplazos sucesivos sin una cadena formal de migraciones.
- Ejecutar `sql/` en orden de nombre podria mezclar creacion parcial, hardening y regularizaciones productivas; el siguiente gate seguro es export schema-only autorizado, revision y conversion a baseline ordenada.
- Un access token de plataforma no sustituye el password/connection string requerido para un dump DB verificable; no debe usarse para recuperar, rotar o inventar credenciales.
- Los RPCs schema-only pueden contener `INSERT INTO` dentro del cuerpo de funciones. Ese match exige revision manual para distinguir codigo de funcion frente a filas exportadas y bloquea una conversion automatica ingenua.
- El baseline revisado ya existe, pero no incluye `recurring_invoice_plans` porque tampoco existe en el schema productivo exportado; inventarlo cerraria falsamente el gap y podria activar automatizacion financiera sin contrato real.
- El export solicitado usa `--no-privileges`; antes de declarar QA operativa se deben verificar grants efectivos y visibilidad REST tras el apply, sin asumir que las policies por si solas conceden acceso.
- `supabase/migrations/20260721_qa_baseline_schema.sql` es una baseline exclusiva de QA y no debe aplicarse a produccion, donde los objetos ya existen.
- La baseline se aplico a QA mediante `psql` directo y no registro versiones en `supabase_migrations.schema_migrations`; un futuro `db push` podria intentar reejecutarla. Mitigacion: bloquear CLI push/history repair hasta un gate especifico de reconciliacion.
- El schema QA queda vacio y apto para seed, pero `recurring_invoice_plans` sigue ausente por contrato autoritativo. Ningun seed debe crear esa tabla ni simular el dominio.
- El launcher CDP puede ignorar una sesion sandbox sana y abrir un puerto inutil. La evidencia valida de este sprint reutilizo el endpoint del perfil `.auth/sandbox`; nunca se deben cerrar procesos de navegador personales para resolverlo.
- El seed QA usa IDs deterministas y un gasto con identity override controlado. Cualquier ampliacion debe conservar guards de colision, transaccion atomica y numeros claramente demo; no usar este patron para facturas, pagos ni produccion.
- Reejecutar el seed elimina y recrea exclusivamente sus 15 filas marcadas. Cambiar el marker o ampliar deletes por prefijo sin comprobar contenido podria tocar QA manual; exigir revision y prueba dry-run.
- La baseline post-seed aun no es un snapshot restaurable. Autorizar write-and-clean antes de probar restore dejaria residuos o secuencias sin via demostrada de recuperacion.
- El plan Free de Supabase QA no ofrece backups programados ni PITR, y no existe preview branch. Un dump privado reduce el riesgo de perdida, pero no demuestra restauracion hasta ejecutar un restore destructivo autorizado.
- El cleanup logico probado solo cubre una fila no financiera con marker exacto. No restaura secuencias, audit trails, webhooks, auth, storage ni efectos externos, por lo que no habilita full-submit ni dominios financieros.
- `qa:sandbox:restore-proof` aborta antes del dump si `public` contiene algo distinto de las 15 filas sinteticas aprobadas; ampliar esa regla o el alcance del dump exige revision para evitar capturar datos QA manuales o reales.
- Un write-and-clean posterior debe usar el registro por entidad y fallar si no elimina exactamente la fila creada. La prueba de lead no sustituye la evidencia propia de client/property/quote/expense/job.

## Integracion con el mapa universal de riesgo

[UNIVERSAL_RISK_ZONES.md](UNIVERSAL_RISK_ZONES.md) aporta la clasificacion reutilizable para datos/backend, finanzas/fiscalidad, frontend/UX, produccion/deploy y marca/diseno. Este `RISK_MAP.md` sigue siendo la fuente especifica y mas estricta para Costa Clean.

Cada correccion debe revisar ambos mapas antes de definir alcance. [UNIVERSAL_CORRECTION_SYSTEM.md](UNIVERSAL_CORRECTION_SYSTEM.md) gobierna diagnostico y validacion; [UX_UI_CORRECTION_SYSTEM.md](UX_UI_CORRECTION_SYSTEM.md) las correcciones visuales; [UNIVERSAL_RELEASE_SYSTEM.md](UNIVERSAL_RELEASE_SYSTEM.md) y [UNIVERSAL_RELEASE_LOG.md](UNIVERSAL_RELEASE_LOG.md) la entrega y trazabilidad; [CODEX_UNIVERSAL_CORRECTOR_PROTOCOL.md](CODEX_UNIVERSAL_CORRECTOR_PROTOCOL.md) aporta prompts, nunca autorizaciones.

## Riesgos del Full App Production Audit - 2026-07-21

- Un puerto local valido puede pertenecer a otro producto. El harness ahora valida `CostaClean` en el titulo durante deteccion y tras abrir CDP; no se reutiliza evidencia previa a esa verificacion.
- El bearer anonimo de `PropertyDetailCard`, altas de propiedad y estado rapido de `JobDetailCard` quedo corregido: `apikey` conserva la anon key y `Authorization` exige `session.access_token`. El riesgo residual es de policies/RLS; 401/403 se preservan y no se ha ejecutado write-and-clean.
- El servicio contextual desde propiedad ya abre en Agenda cuando cliente y propiedad estan fijados. Cualquier ampliacion futura debe conservar Contexto para el alta general y para prefills que aun necesiten elegir propiedad.
- Sustituir PNG de marca por SVG puede reducir peso, pero requiere verificar logo, transparencia, documentos impresos y superficies claras/oscuras antes de publicar.
- El CSS global y los componentes grandes son deuda de mantenimiento; no autorizan un refactor masivo ni una reescritura del shell.

Evidencia: [FULL_APP_AUDIT_20260721.md](FULL_APP_AUDIT_20260721.md).

## Riesgos de writes autenticados RLS en QA - 2026-07-21

- Una sesión válida y un HTTP 200 no prueban que RLS haya permitido un PATCH: PostgREST puede devolver cero filas. Todo write debe exigir representación exacta y reconciliar estado persistido.
- Las policies QA actuales bloquean INSERT directo autenticado de `clients` y `properties`, y hacen invisibles los PATCH directos de `properties` y `jobs`; no se debe recuperar operatividad usando bearer anon.
- `reassign_property_client` y `save_job_with_lines` persisten como RPC. No ampliar ni alterar sus grants, SECURITY DEFINER o contratos sin auditoría y autorización separadas.
- El operador DB privado solo puede preparar fixtures y limpiar IDs/marcador exactos; nunca cuenta como evidencia de RLS del usuario.
- Evidencia: [QA_AUTH_RLS_WRITE_VERIFICATION_20260721.md](QA_AUTH_RLS_WRITE_VERIFICATION_20260721.md).

## RLS/RPC write-path closure risk - 2026-07-21

- The target tables have no tenant ownership columns or role claims. Authenticated RPCs are safe for the current single-workspace model but are not a multi-tenant authorization design.
- Anon INSERT/UPDATE was removed from clients/properties/jobs. Reintroducing direct REST writes requires an ownership model, not `USING (true)`.
- Anon SELECT remains unchanged for compatibility and requires a separate privacy/read-path audit.
- `reassign_property_client` is now reachable only through an authenticated wrapper; do not restore its public/anon EXECUTE grant.
- Direct `psql` apply to QA does not reconcile Supabase migration history. `db push` remains blocked until a dedicated history gate.
- Evidence: [RLS_WRITE_PATH_FIX_20260721.md](RLS_WRITE_PATH_FIX_20260721.md).
