import { normalizeAddress, normalizeLooseText, normalizeText } from '../duplicates/normalization'
import type { DuplicateReason } from '../duplicates/types'
import type { PropertyListItem } from './types'

export interface PropertyDuplicateFingerprint {
  clientId: string
  name: string
  address: string
  city: string
  postalCode: string
  propertyType: string
}

export function normalizePropertyFingerprint(property: Pick<PropertyListItem, 'client_id' | 'name' | 'address' | 'city' | 'postal_code' | 'property_type'>): PropertyDuplicateFingerprint {
  return {
    clientId: normalizeText(property.client_id),
    name: normalizeLooseText(property.name),
    address: normalizeAddress(property.address),
    city: normalizeLooseText(property.city),
    postalCode: normalizeLooseText(property.postal_code),
    propertyType: normalizeText(property.property_type),
  }
}

export function buildPropertyDuplicateKey(property: Pick<PropertyListItem, 'client_id' | 'name' | 'address' | 'city' | 'postal_code' | 'property_type'>): string {
  const fingerprint = normalizePropertyFingerprint(property)
  return [
    fingerprint.clientId,
    fingerprint.address,
    fingerprint.name,
    fingerprint.city,
    fingerprint.postalCode,
    fingerprint.propertyType,
  ].join('::')
}

export function comparePropertyCandidates(
  left: Pick<PropertyListItem, 'client_id' | 'name' | 'address' | 'city' | 'postal_code' | 'property_type'>,
  right: Pick<PropertyListItem, 'client_id' | 'name' | 'address' | 'city' | 'postal_code' | 'property_type'>,
): DuplicateReason[] {
  const leftFingerprint = normalizePropertyFingerprint(left)
  const rightFingerprint = normalizePropertyFingerprint(right)

  if (!leftFingerprint.clientId || leftFingerprint.clientId !== rightFingerprint.clientId) {
    return []
  }

  const reasons: DuplicateReason[] = []
  const sameAddress = leftFingerprint.address && leftFingerprint.address === rightFingerprint.address
  const sameName = leftFingerprint.name && leftFingerprint.name === rightFingerprint.name
  const sameCity = leftFingerprint.city && leftFingerprint.city === rightFingerprint.city
  const samePostal = leftFingerprint.postalCode && leftFingerprint.postalCode === rightFingerprint.postalCode
  const sameType = leftFingerprint.propertyType && leftFingerprint.propertyType === rightFingerprint.propertyType

  if (sameAddress) {
    reasons.push({ code: 'property-client-address', label: 'Coinciden cliente y direccion', severity: 'exact' })
  }

  if (sameAddress && (sameCity || samePostal || sameType)) {
    reasons.push({ code: 'property-address-zone', label: 'Coinciden direccion y contexto operativo', severity: 'strong' })
  }

  if (sameName && (sameAddress || sameCity || samePostal)) {
    reasons.push({ code: 'property-client-name', label: 'Coinciden cliente y nombre interno', severity: 'probable' })
  }

  return reasons
}
