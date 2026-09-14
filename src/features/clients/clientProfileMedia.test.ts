import { describe, expect, it } from 'vitest'
import {
  CLIENT_PROFILE_IMAGE_MAX_BYTES,
  buildClientProfileImagePath,
  getClientInitials,
  removeClientProfileImage,
  resolveClientProfileImageSignedUrl,
  saveClientProfileImage,
  validateClientProfileImage,
} from './clientProfileMedia'

const client = { id: 'CLIENT-1', full_name: 'Costa Clean', profile_image_path: null, display_code: 'CLI-0001', phone: null, email: null, tax_id: null, billing_address: null, status: 'active', source_lead_id: null }

function imageFile(type = 'image/png', size = 128) {
  return { type, size } as File
}

describe('client profile media contract', () => {
  it('validates supported image MIME types and the 5 MB limit', () => {
    expect(validateClientProfileImage(imageFile('image/png'))).toBeNull()
    expect(validateClientProfileImage(imageFile('image/gif'))).toContain('JPEG')
    expect(validateClientProfileImage(imageFile('image/png', CLIENT_PROFILE_IMAGE_MAX_BYTES + 1))).toContain('5 MB')
  })

  it('uses a non-sensitive client path and does not use the original filename', () => {
    const path = buildClientProfileImagePath('CLIENT-1', 'image/jpeg', '8d7e9fd5-2d8b-42d6-a1b8-2a6a3c1f92cc')
    expect(path).toBe('clients/CLIENT-1/8d7e9fd5-2d8b-42d6-a1b8-2a6a3c1f92cc.jpg')
    expect(path).not.toContain('Costa')
    expect(path).not.toContain('@')
  })

  it('uploads before pointer persistence and removes the old object only afterwards', async () => {
    const events: string[] = []
    const result = await saveClientProfileImage({
      clientId: client.id,
      file: imageFile(),
      existingPath: 'clients/CLIENT-1/old.png',
      dependencies: {
        upload: async () => { events.push('upload'); return { filePath: 'clients/CLIENT-1/new.png' } },
        persistPath: async (_id, path) => { events.push(`persist:${path}`); return { ...client, profile_image_path: path } },
        remove: async (path) => { events.push(`remove:${path}`) },
      },
    })
    expect(result.filePath).toBe('clients/CLIENT-1/new.png')
    expect(result.cleanupError).toBeNull()
    expect(events).toEqual(['upload', 'persist:clients/CLIENT-1/new.png', 'remove:clients/CLIENT-1/old.png'])
  })

  it('cleans the new object and keeps the old pointer when persistence fails', async () => {
    const removed: string[] = []
    await expect(saveClientProfileImage({
      clientId: client.id,
      file: imageFile(),
      existingPath: 'clients/CLIENT-1/old.png',
      dependencies: {
        upload: async () => ({ filePath: 'clients/CLIENT-1/new.png' }),
        persistPath: async () => { throw new Error('DB blocked') },
        remove: async (path) => { removed.push(path) },
      },
    })).rejects.toThrow('DB blocked')
    expect(removed).toEqual(['clients/CLIENT-1/new.png'])
  })

  it('clears the DB pointer before removing an image and reports storage cleanup separately', async () => {
    const events: string[] = []
    const result = await removeClientProfileImage({
      clientId: client.id,
      existingPath: 'clients/CLIENT-1/old.png',
      dependencies: {
        upload: async () => ({ filePath: 'unused' }),
        persistPath: async (_id, path) => { events.push(`persist:${path}`); return { ...client, profile_image_path: path } },
        remove: async () => { events.push('remove'); throw new Error('storage unavailable') },
      },
    })
    expect(events).toEqual(['persist:null', 'remove'])
    expect(result.client.profile_image_path).toBeNull()
    expect(result.cleanupError?.message).toBe('storage unavailable')
  })

  it('returns initials fallback without raw identifiers and handles signed URL failure', async () => {
    expect(getClientInitials('Anderson Marquez')).toBe('AM')
    expect(getClientInitials('Costa Clean')).toBe('CC')
    expect(getClientInitials('Elena')).toBe('EL')
    expect(await resolveClientProfileImageSignedUrl(null)).toBeNull()
    expect(await resolveClientProfileImageSignedUrl('clients/CLIENT-1/image.png', async () => { throw new Error('missing') })).toBeNull()
  })
})
