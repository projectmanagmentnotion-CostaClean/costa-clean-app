import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabasePublicEnv } from './supabaseEnv'

let supabaseClient: SupabaseClient | null = null
const authLockQueue = new Map<string, Promise<void>>()

async function withInMemoryAuthLock<R>(name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  const previousLock = authLockQueue.get(name) ?? Promise.resolve()
  let releaseLock!: () => void

  const currentLock = new Promise<void>((resolve) => {
    releaseLock = resolve
  })

  const queueTail = previousLock.then(() => currentLock)
  authLockQueue.set(name, queueTail)

  await previousLock

  try {
    return await fn()
  } finally {
    releaseLock()

    if (authLockQueue.get(name) === queueTail) {
      authLockQueue.delete(name)
    }
  }
}

export function getSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv()

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      client: null,
      error: 'Faltan las variables de entorno de Supabase.',
    }
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        lock: withInMemoryAuthLock,
      },
    })
  }

  return {
    client: supabaseClient,
    error: null,
  }
}
