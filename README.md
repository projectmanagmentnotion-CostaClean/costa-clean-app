# CostaClean CRM

Rebuild profesional de CostaClean CRM desde cero.

## Stack actual

- React
- Vite
- TypeScript
- Supabase
- VS Code + terminal

## Objetivo

Construir una base limpia, escalable y profesional para el nuevo CRM de CostaClean, sustituyendo la versión anterior basada en Apps Script.

## Estado actual validado

### Leads
- navegación mínima operativa
- listado real conectado a Supabase
- creación real
- detalle simple
- búsqueda y filtros
- edición real
- archivado suave y restauración
- ocultar archivados por defecto
- mostrar archivados bajo demanda

### Supabase
- proyecto creado y conectado
- tabla public.leads operativa
- RLS activa
- policies mínimas para SELECT, INSERT y UPDATE
- columna archived_at añadida a leads

## Variables de entorno

Crear un archivo .env.local en la raíz con estas claves:

VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

Usar .env.example como plantilla.

## Arranque local

npm install
npm run dev

App local:
http://localhost:5173/

## Flujo de trabajo obligatorio

- no asumir nada
- primero leer/verificar
- luego modificar
- usar pasos cortos y comprobables
- trabajar desde VS Code + terminal
- basarse siempre en output real

## Trabajo entre varios ordenadores

Flujo recomendado:
1. git pull
2. verificar .env.local
3. npm install si cambió algo
4. npm run dev

## Próximo bloque previsto

- levantar módulo Clients base conectado a Supabase
- después preparar conversión lead -> client
