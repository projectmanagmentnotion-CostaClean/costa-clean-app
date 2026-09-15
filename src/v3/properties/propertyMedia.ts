import type { PropertyListItem } from '../../features/properties/types'

export type PropertyMediaType = 'apartment' | 'house' | 'office' | 'local' | 'tourist_apartment' | 'community' | 'construction_site'

export interface PropertyMedia {
  src: `/assets/properties/${string}.webp`
  alt: string
  type: PropertyMediaType | 'fallback'
}

const mediaByType: Record<PropertyMediaType, PropertyMedia> = {
  apartment: { type: 'apartment', src: '/assets/properties/apartment.webp', alt: 'Interior genérico de apartamento' },
  house: { type: 'house', src: '/assets/properties/house.webp', alt: 'Exterior genérico de casa' },
  office: { type: 'office', src: '/assets/properties/office.webp', alt: 'Interior genérico de oficina' },
  local: { type: 'local', src: '/assets/properties/local.webp', alt: 'Interior genérico de local' },
  tourist_apartment: { type: 'tourist_apartment', src: '/assets/properties/tourist-apartment.webp', alt: 'Interior genérico de piso turístico' },
  community: { type: 'community', src: '/assets/properties/community.webp', alt: 'Exterior genérico de comunidad' },
  construction_site: { type: 'construction_site', src: '/assets/properties/construction-site.webp', alt: 'Obra residencial genérica' },
}

export const fallbackPropertyMedia: PropertyMedia = { type: 'fallback', src: '/assets/properties/fallback.webp', alt: 'Imagen genérica de inmueble' }

export function getPropertyMedia(propertyType: string | null | undefined): PropertyMedia {
  return propertyType && propertyType in mediaByType ? mediaByType[propertyType as PropertyMediaType] : fallbackPropertyMedia
}

export function getPropertyMediaForProperty(property: Pick<PropertyListItem, 'property_type'>): PropertyMedia {
  return getPropertyMedia(property.property_type)
}
