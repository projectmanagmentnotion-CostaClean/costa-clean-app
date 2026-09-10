# Costa Clean local orchestrator

Flujo semiautomático y local para una única conversación autorizada. El servidor solo escucha en `127.0.0.1`; la extensión solo tiene permiso para la conversación fijada en `manifest.json`.

## Uso

1. Ejecutar `node tools/costa-clean-orchestrator/server.mjs`.
2. Chrome → `chrome://extensions` → Developer mode → Load unpacked → seleccionar `tools/costa-clean-orchestrator/extension`.
3. Configurar el puerto y, si se habilita, el token local. `autoPaste` solo crea un borrador; nunca pulsa Enviar.
4. El servidor recibe el mensaje nuevo, deduplica por id/hash y guarda estado/inbox bajo `.orchestrator/`.
5. Tras editar manualmente con alcance aprobado, `POST /validate` ejecuta únicamente `npm test`, `npm run lint` y `npm run build`.

## Puertas de seguridad

Producción, Supabase/base de datos/migraciones/RPC, credenciales, `git commit` y `git push` quedan fuera del flujo automático y requieren decisión humana separada. No se ejecuta shell arbitrario, no se envían datos a terceros y no se procesan otras conversaciones. El estado local contiene texto de prompts: permanece ignorado por Git.

## Limitación intencional

El orquestador prepara el run y valida cambios locales; no inventa un implementador LLM ni aplica prompts arbitrarios. La implementación sigue siendo una acción revisable del agente local o del desarrollador, después de pasar la validación de alcance.
