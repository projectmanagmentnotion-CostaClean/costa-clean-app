import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./adapters/portalSupabaseClient', () => ({
  getPortalSupabaseClient: vi.fn(),
}))

import { getPortalSupabaseClient } from './adapters/portalSupabaseClient'
import { loadPortalFoundationData } from './portalReadApi'

const mockedGetPortalSupabaseClient = vi.mocked(getPortalSupabaseClient)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('portal read api', () => {
  it('uses the backend property display code as the public portal reference', async () => {
    const client = createMockPortalClient(async (functionName: string) => {
          switch (functionName) {
            case 'portal_get_client_profile':
              return {
                data: {
                  fullName: 'Cliente QA',
                  phone: '+34 600 100 200',
                  email: 'cliente.qa@example.invalid',
                  taxId: 'B12345678',
                  billingAddress: 'Av. Marina 12',
                  status: 'active',
                },
                error: null,
              }
            case 'portal_list_properties':
              return {
                data: [
                  {
                    id: 'property-qa-1',
                    display_code: 'PRO-9001',
                    name: 'Espacio Norte',
                    propertyType: 'vivienda',
                    address: 'Calle Marina 12',
                    city: 'Barcelona',
                    postalCode: '08001',
                    status: 'active',
                  },
                ],
                error: null,
              }
            case 'portal_get_property':
              return {
                data: {
                  id: 'property-qa-1',
                  name: 'Espacio Norte',
                  propertyType: 'vivienda',
                  address: 'Calle Marina 12',
                  city: 'Barcelona',
                  postalCode: '08001',
                  status: 'active',
                },
                error: null,
              }
            case 'portal_list_services':
              return {
                data: null,
                error: { message: 'boom' },
              }
            case 'portal_list_service_requests':
              return {
                data: [],
                error: null,
              }
            case 'portal_list_invoices':
              return {
                data: [],
                error: null,
              }
            case 'portal_list_own_profile_change_requests_v2':
              return {
                data: [],
                error: null,
              }
            case 'portal_list_own_property_change_requests_v2':
              return {
                data: [],
                error: null,
              }
            default:
              return {
                data: [],
                error: null,
              }
          }
    })

    mockedGetPortalSupabaseClient.mockReturnValue({
      client,
      error: null,
    })

    const data = await loadPortalFoundationData(
      {
        clientContextId: 'client-qa',
        role: 'client_member',
      },
      '/portal/properties/PRO-9001',
    )

    expect(data.properties[0]?.publicRef).toBe('PRO-9001')
    expect(data.propertyDetail?.publicRef).toBe('PRO-9001')
    expect(data.capabilities.properties.status).toBe('REAL')
    expect(data.capabilities.services.status).toBe('ERROR')
    expect(data.capabilities.profile.status).toBe('REAL')
  })

  it('keeps other capabilities readable when one read fails', async () => {
    const client = createMockPortalClient(async (functionName: string) => {
          if (functionName === 'portal_list_services') {
            return { data: null, error: { message: 'boom' } }
          }

          if (functionName === 'portal_get_client_profile') {
            return {
              data: {
                fullName: 'Cliente QA',
                phone: '+34 600 100 200',
                email: 'cliente.qa@example.invalid',
                taxId: 'B12345678',
                billingAddress: 'Av. Marina 12',
                status: 'active',
              },
              error: null,
            }
          }

          if (functionName === 'portal_list_properties') {
            return {
              data: [
                {
                  id: 'property-qa-1',
                  display_code: 'PRO-9001',
                  name: 'Espacio Norte',
                  propertyType: 'vivienda',
                  address: 'Calle Marina 12',
                  city: 'Barcelona',
                  postalCode: '08001',
                  status: 'active',
                },
              ],
              error: null,
            }
          }

          return {
            data: [],
            error: null,
          }
    })

    mockedGetPortalSupabaseClient.mockReturnValue({
      client,
      error: null,
    })

    const data = await loadPortalFoundationData(
      {
        clientContextId: 'client-qa',
        role: 'client_admin',
      },
      '/portal',
    )

    expect(data.profile.fullName).toBe('Cliente QA')
    expect(data.properties).toHaveLength(1)
    expect(data.capabilities.services.status).toBe('ERROR')
    expect(data.capabilities.profile.status).toBe('REAL')
    expect(data.capabilities.properties.status).toBe('REAL')
  })
})

function createMockPortalClient(
  rpcImpl: (functionName: string) => Promise<{ data: unknown; error: { message: string } | null }>,
) {
  return {
    rpc: rpcImpl,
  } as unknown as NonNullable<ReturnType<typeof getPortalSupabaseClient>['client']>
}
