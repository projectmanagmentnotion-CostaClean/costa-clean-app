import { createPortalHandler } from '../_shared/portalHandler.ts'

type Runtime = typeof globalThis & {
  Deno?: {
    env: { get(name: string): string | undefined }
    serve(handler: (request: Request) => Response | Promise<Response>): void
  }
}

const runtime = globalThis as Runtime
if (!runtime.Deno) throw new Error('Supabase Edge runtime is unavailable.')

runtime.Deno.serve(createPortalHandler('service', {
  env: (name) => runtime.Deno?.env.get(name),
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
  log: (event) => console.info(JSON.stringify(event)),
}))
