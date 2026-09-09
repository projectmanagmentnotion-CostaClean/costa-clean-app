import type { PropertyListItem } from '../../features/properties/types'
import { getPropertyTypeLabel } from '../../app/displayFormat'
import { V3EntityListItem, V3Status } from '../components/V3Primitives'

export function V3PropertyRow({ property, onOpen }: { property: PropertyListItem; onOpen: () => void }) {
  const status = property.archived_at || property.deleted_at ? 'Archivado' : 'Activo'
  return <V3EntityListItem onClick={onOpen} ariaLabel={`Abrir inmueble ${property.name}`}>
    <div className="v3-property-row__main"><strong>{property.name}</strong><span>{property.display_code ?? property.id} · {property.client_name ?? property.client_display_code ?? property.client_id}</span><small>{property.address}{property.city ? ` · ${property.city}` : ''}</small></div>
    <div className="v3-property-row__side"><span>{getPropertyTypeLabel(property.property_type)}</span><V3Status label={status} tone={status === 'Activo' ? 'success' : 'neutral'} /></div>
  </V3EntityListItem>
}
