import { createPortalHandler } from '../_shared/portalHandler.ts'

type Runtime = typeof globalThis & {
  Deno?: {
    env: { get(name: string): string | undefined }
    serve(handler: (request: Request) => Response | Promise<Response>): void
  }
}

const runtime = globalThis as Runtime
if (!runtime.Deno) throw new Error('Supabase Edge runtime is unavailable.')

runtime.Deno.serve(createPortalHandler('members', {
  env: (name) => runtime.Deno?.env.get(name),
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
  log: (event) => console.info(JSON.stringify(event)),
  // CP-2A never sends email. CP-2B must inject an explicitly authorized
  // sandbox delivery adapter before invitation creation can succeed.
  deliverInvitation: undefined,
}))
