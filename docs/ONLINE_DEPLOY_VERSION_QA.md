# Online Deploy Version QA

## Fecha

- 2026-07-01

## Contexto confirmado

- El usuario no estaba probando `localhost`.
- El comportamiento observado venia del dominio online `https://app.costacleanbcn.com`.
- Esto explicaba la ausencia de:
  - panel debug visible
  - banner trace
  - fixes recientes de lineas si el dominio seguia sirviendo un build anterior

## Estado local verificado antes de publicar

Comandos ejecutados:

```bash
git status
git branch --show-current
git pull origin main
git log --oneline -10
```

Resultado:

- rama local: `main`
- working tree: limpio antes de anadir la build info
- `git pull origin main`: sin cambios pendientes
- ultimo commit funcional verificado antes de este sprint de publicacion:
  - `5ed738d chore: force visible job editor line trace`

## Sistema de deploy encontrado

- plataforma: Vercel
- proyecto Vercel: `costa-clean-app`
- dominio de produccion:
  - `https://app.costacleanbcn.com`
- alias adicionales de produccion:
  - `https://costa-clean-app.vercel.app`
  - `https://costa-clean-app-projectmanagmentnotion-costacleans-projects.vercel.app`
- rama usada para deploy:
  - `main`
- tipo de publicacion:
  - despliegue automatico conectado a Git + despliegues de produccion visibles en Vercel CLI
- comando de build del repo:
  - `npm run build`
  - resuelve a `tsc -b && vite build`
- carpeta publicada:
  - `dist/`
- routing de SPA:
  - `vercel.json` reescribe `/(.*)` hacia `/index.html`

## Build info anadida

Archivos anadidos o modificados:

- `vite.config.ts`
- `src/app/buildInfo.ts`
- `src/app/BuildInfoBadge.tsx`
- `src/vite-env.d.ts`
- `src/App.tsx`
- `src/App.css`

Comportamiento:

- la build expone metadatos compilados:
  - `commit`
  - `version`
  - `builtAt`
- la UI muestra una marca discreta con:
  - `build <commit>`
  - `<version>`
- activacion por query param:
  - `?debugBuild=1`

Objetivo:

- verificar online que el dominio sirve el commit realmente desplegado
- separar un bug de codigo de un build no publicado

## Validacion local ejecutada

Comandos ejecutados:

```bash
npm run lint
npm run test
npm run build
```

Resultado:

- `lint`: OK
- `test`: OK
  - `19` archivos
  - `71` tests
- `build`: OK
- `dist/` regenerado correctamente

## Cache y service worker

- No se detecto en este turno evidencia de service worker propio en el repo como causa principal.
- La verificacion final online debe hacerse con:
  - ventana incognito
  - hard refresh
  - URL con `?debugBuild=1`

## URL de verificacion

- principal:
  - `https://app.costacleanbcn.com/?debugBuild=1`

## Resultado esperado de QA online

1. Ver la marca `build <commit>` en pantalla.
2. Confirmar que el commit visible coincide con el deployment activo en Vercel.
3. Abrir `Servicios`.
4. Abrir `JOB-0052`.
5. Entrar en `Editar servicio`.
6. Confirmar si aparecen:
   - banner trace
   - debug panel
   - o el editor ya corregido con varias lineas

## Pendientes reales

- confirmar visualmente en el dominio el commit servido tras el push final
- confirmar visualmente el estado de `JOB-0052` sobre el build de produccion ya publicado
- si el dominio mostrara un commit viejo tras el push, forzar redeploy o revisar cache/CDN en Vercel
