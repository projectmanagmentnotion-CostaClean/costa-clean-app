import { createPublicQuizHandler } from '../_shared/publicQuizHandler.ts'

type EdgeRuntime = typeof globalThis & {
  Deno?: {
    env: { get(name: string): string | undefined }
    serve(handler: (request: Request) => Response | Promise<Response>): void
  }
}

const runtime = globalThis as EdgeRuntime
if (!runtime.Deno) throw new Error('Supabase Edge runtime is unavailable.')

const handler = createPublicQuizHandler({
  env: (name) => runtime.Deno?.env.get(name),
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
  log: (event) => console.info(JSON.stringify(event)),
})

runtime.Deno.serve(handler)
