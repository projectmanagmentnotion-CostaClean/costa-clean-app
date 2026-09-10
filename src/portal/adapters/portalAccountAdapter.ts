import {
  getPortalMarketingPreference,
  listPortalMembers,
  listPortalPendingInvitations,
  revokePortalMember,
  setPortalMarketingPreference,
  type PortalMarketingPreference,
  type PortalMember,
  type PortalPendingInvitation,
} from './portalAccountActions'
import { createPortalPreviewAccountAdapter } from './portalPreviewAdapter'
import { readPortalPreviewScenario } from './portalPreviewAdapter'

export interface PortalAccountAdapter {
  listMembers(clientId: string): Promise<PortalMember[]>
  listPendingInvitations(clientId: string): Promise<PortalPendingInvitation[]>
  revokeMember(clientId: string, membershipId: string): Promise<void>
  getMarketingPreference(clientId: string, locale: string): Promise<PortalMarketingPreference>
  setMarketingPreference(clientId: string, enabled: boolean, locale: string): Promise<PortalMarketingPreference>
}

const productionAccountAdapter: PortalAccountAdapter = {
  listMembers: listPortalMembers,
  listPendingInvitations: listPortalPendingInvitations,
  revokeMember: revokePortalMember,
  getMarketingPreference: getPortalMarketingPreference,
  setMarketingPreference: setPortalMarketingPreference,
}

export function createPortalAccountAdapter(search: string): PortalAccountAdapter {
  const scenario = readPortalPreviewScenario(search)
  return scenario ? createPortalPreviewAccountAdapter(scenario) : productionAccountAdapter
}
