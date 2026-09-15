import type { PropertyListItem } from '../../features/properties/types'
import { getPropertyTypeLabel } from '../../app/displayFormat'
import { V3EntityListItem, V3Status } from '../components/V3Primitives'
import { getPropertyMediaForProperty } from './propertyMedia'

export function V3PropertyRow({ property, onOpen }: { property: PropertyListItem; onOpen: () => void }) {
  const status = property.archived_at || property.deleted_at ? 'Archivado' : 'Activo'
  const media = getPropertyMediaForProperty(property)
  return <V3EntityListItem className="v3-property-row" onClick={onOpen} ariaLabel={`Abrir inmueble ${property.name}`}>
    <img className="v3-property-row__media" src={media.src} alt={media.alt} loading="lazy" />
    <div className="v3-property-row__main"><strong>{property.name}</strong><span>{property.display_code ?? 'Sin código'} · {property.client_name ?? property.client_display_code ?? 'Cliente sin nombre'}</span><small>{property.address}{property.city ? ` · ${property.city}` : ''}</small></div>
    <div className="v3-property-row__side"><span>{getPropertyTypeLabel(property.property_type)}</span><V3Status label={status} tone={status === 'Activo' ? 'success' : 'neutral'} /></div>
  </V3EntityListItem>
}
