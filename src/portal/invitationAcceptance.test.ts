import { describe, expect, it, vi } from 'vitest'
import {
  isPortalInvitationAcceptancePath,
  portalInvitationAcceptancePath,
  readPortalInvitationToken,
  takePortalInvitationToken,
} from './invitationAcceptance'

const token = 'A'.repeat(43)

describe('portal invitation acceptance URL boundary', () => {
  it('uses one canonical public route', () => {
    expect(portalInvitationAcceptancePath).toBe('/portal/invitacion')
    expect(isPortalInvitationAcceptancePath('/portal/invitacion/')).toBe(true)
    expect(isPortalInvitationAcceptancePath('/portal/invitacion/other')).toBe(false)
  })

  it('accepts only one token fragment and rejects query-like extras', () => {
    expect(readPortalInvitationToken(`#token=${token}`)).toBe(token)
    expect(readPortalInvitationToken(`#token=${token}&state=unexpected`)).toBeNull()
    expect(readPortalInvitationToken(`#token=${token}&token=${token}`)).toBeNull()
    expect(readPortalInvitationToken('?token=' + token)).toBeNull()
    expect(readPortalInvitationToken('#token=short')).toBeNull()
  })

  it('removes a valid or invalid fragment before the portal starts authentication', () => {
    const replaceState = vi.fn()
    const accepted = takePortalInvitationToken({
      pathname: '/portal/invitacion',
      search: '',
      hash: `#token=${token}`,
    }, { replaceState })
    expect(accepted).toBe(token)
    expect(replaceState).toHaveBeenCalledWith(null, '', '/portal/invitacion')

    replaceState.mockClear()
    const rejected = takePortalInvitationToken({
      pathname: '/portal/invitacion',
      search: '?source=email',
      hash: '#token=invalid',
    }, { replaceState })
    expect(rejected).toBeNull()
    expect(replaceState).toHaveBeenCalledWith(null, '', '/portal/invitacion?source=email')
  })

  it('does not consume fragments from other portal routes', () => {
    const replaceState = vi.fn()
    expect(takePortalInvitationToken({
      pathname: '/portal/login',
      search: '',
      hash: `#token=${token}`,
    }, { replaceState })).toBeNull()
    expect(replaceState).not.toHaveBeenCalled()
  })
})
