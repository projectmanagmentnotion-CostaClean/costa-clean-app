import { getSupabaseClient } from '../../lib/supabase.ts'
import { updateClientRecord } from './clientWriteApi.ts'
import type { ClientListItem } from './types.ts'

export const CLIENT_PROFILE_MEDIA_BUCKET = 'client-profile-media'
export const CLIENT_PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const CLIENT_PROFILE_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

type ClientProfileImageMimeType = typeof CLIENT_PROFILE_IMAGE_MIME_TYPES[number]

const MIME_TO_EXTENSION: Record<ClientProfileImageMimeType, 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function validateClientProfileImage(file: Pick<File, 'type' | 'size'>): string | null {
  if (!CLIENT_PROFILE_IMAGE_MIME_TYPES.includes(file.type as ClientProfileImageMimeType)) {
    return 'La foto debe ser JPEG, PNG o WEBP.'
  }
  if (file.size > CLIENT_PROFILE_IMAGE_MAX_BYTES) {
    return 'La foto no puede superar 5 MB.'
  }
  return null
}

function createObjectId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function buildClientProfileImagePath(clientId: string, mimeType: string, objectId = createObjectId()): string {
  const normalizedClientId = clientId.trim()
  if (!normalizedClientId || normalizedClientId.includes('/') || normalizedClientId.includes('..')) {
    throw new Error('No se pudo preparar la foto porque falta un cliente valido.')
  }
  const extension = MIME_TO_EXTENSION[mimeType as ClientProfileImageMimeType]
  if (!extension) {
    throw new Error('La foto debe ser JPEG, PNG o WEBP.')
  }
  return `clients/${normalizedClientId}/${objectId}.${extension}`
}

function getStorageClient() {
  const { client, error } = getSupabaseClient()
  if (!client) {
    throw new Error(error ?? 'No se pudo inicializar Supabase.')
  }
  return client
}

export async function uploadClientProfileImage(clientId: string, file: File): Promise<{ filePath: string }> {
  const validationError = validateClientProfileImage(file)
  if (validationError) throw new Error(validationError)

  const filePath = buildClientProfileImagePath(clientId, file.type)
  const { error } = await getStorageClient().storage.from(CLIENT_PROFILE_MEDIA_BUCKET).upload(filePath, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return { filePath }
}

export async function createClientProfileImageSignedUrl(filePath: string, expiresIn = 3600): Promise<string> {
  if (!filePath.trim()) throw new Error('Falta la ruta de la foto del cliente.')
  const { data, error } = await getStorageClient().storage.from(CLIENT_PROFILE_MEDIA_BUCKET).createSignedUrl(filePath, expiresIn)
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'No se pudo cargar la foto del cliente.')
  return data.signedUrl
}

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()
const signedUrlPending = new Map<string, Promise<string | null>>()
const SIGNED_URL_CACHE_TTL_MS = 50 * 60 * 1000

export async function resolveClientProfileImageSignedUrl(
  filePath: string | null | undefined,
  resolveUrl: (path: string) => Promise<string> = createClientProfileImageSignedUrl,
): Promise<string | null> {
  const normalizedPath = filePath?.trim()
  if (!normalizedPath) return null

  const cached = signedUrlCache.get(normalizedPath)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const pending = signedUrlPending.get(normalizedPath)
  if (pending) return pending

  const request = resolveUrl(normalizedPath)
    .then((url) => {
      signedUrlCache.set(normalizedPath, { url, expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS })
      return url
    })
    .catch(() => null)
    .finally(() => signedUrlPending.delete(normalizedPath))
  signedUrlPending.set(normalizedPath, request)
  return request
}

export async function deleteClientProfileImage(filePath: string): Promise<void> {
  if (!filePath.trim()) return
  const { error } = await getStorageClient().storage.from(CLIENT_PROFILE_MEDIA_BUCKET).remove([filePath])
  if (error) throw new Error(error.message)
  signedUrlCache.delete(filePath)
}

type ProfileMediaDependencies = {
  upload: (clientId: string, file: File) => Promise<{ filePath: string }>
  persistPath: (clientId: string, filePath: string | null) => Promise<ClientListItem>
  remove: (filePath: string) => Promise<void>
}

const defaultProfileMediaDependencies: ProfileMediaDependencies = {
  upload: uploadClientProfileImage,
  persistPath: (clientId, filePath) => updateClientRecord(clientId, { profile_image_path: filePath }),
  remove: deleteClientProfileImage,
}

export async function saveClientProfileImage({
  clientId,
  file,
  existingPath,
  dependencies = defaultProfileMediaDependencies,
}: {
  clientId: string
  file: File
  existingPath?: string | null
  dependencies?: ProfileMediaDependencies
}): Promise<{ client: ClientListItem; filePath: string; cleanupError: Error | null }> {
  const validationError = validateClientProfileImage(file)
  if (validationError) throw new Error(validationError)

  const { filePath } = await dependencies.upload(clientId, file)
  try {
    const client = await dependencies.persistPath(clientId, filePath)
    let cleanupError: Error | null = null
    if (existingPath && existingPath !== filePath) {
      try {
        await dependencies.remove(existingPath)
      } catch (error) {
        cleanupError = error instanceof Error ? error : new Error('No se pudo retirar la foto anterior.')
      }
    }
    return { client, filePath, cleanupError }
  } catch (error) {
    try {
      await dependencies.remove(filePath)
    } catch {
      // Preserve the original DB error. The caller can retry cleanup from the
      // exact object path returned by the upload boundary if needed.
    }
    throw error
  }
}

export async function removeClientProfileImage({
  clientId,
  existingPath,
  dependencies = defaultProfileMediaDependencies,
}: {
  clientId: string
  existingPath: string | null | undefined
  dependencies?: ProfileMediaDependencies
}): Promise<{ client: ClientListItem; cleanupError: Error | null }> {
  const client = await dependencies.persistPath(clientId, null)
  if (!existingPath) return { client, cleanupError: null }

  try {
    await dependencies.remove(existingPath)
    return { client, cleanupError: null }
  } catch (error) {
    return {
      client,
      cleanupError: error instanceof Error ? error : new Error('No se pudo retirar la foto anterior.'),
    }
  }
}

export function getClientInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/u).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toLocaleUpperCase()
}

export const __clientProfileMediaTestUtils = {
  clearSignedUrlCache: () => {
    signedUrlCache.clear()
    signedUrlPending.clear()
  },
}
