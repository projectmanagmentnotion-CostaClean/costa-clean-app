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

function getSupabaseAuthStorageKey(supabaseUrl: string): string | null {
  try {
    return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
  } catch {
    return null
  }
}

export function clearStoredSupabaseSession() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  const { supabaseUrl } = getSupabasePublicEnv()
  const storageKey = getSupabaseAuthStorageKey(supabaseUrl)

  if (!storageKey) {
    return
  }

  window.localStorage.removeItem(storageKey)
  window.localStorage.removeItem(`${storageKey}-code-verifier`)
  window.localStorage.removeItem(`${storageKey}-user`)
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
