import type { DomainRelationshipDefinition } from '../types/domain'

export const domainRelationships: DomainRelationshipDefinition[] = [
  {
    from: 'leads',
    to: 'clients',
    type: 'one-to-one',
    description: 'Un lead puede convertirse en un cliente.',
  },
  {
    from: 'clients',
    to: 'properties',
    type: 'one-to-many',
    description: 'Un cliente puede tener uno o varios inmuebles.',
  },
  {
    from: 'clients',
    to: 'quotes',
    type: 'one-to-many',
    description: 'Un cliente puede recibir múltiples presupuestos.',
  },
  {
    from: 'quotes',
    to: 'quote_lines',
    type: 'one-to-many',
    description: 'Un presupuesto tiene una o varias líneas de detalle.',
  },
  {
    from: 'quotes',
    to: 'jobs',
    type: 'one-to-many',
    description: 'Un presupuesto aceptado puede generar uno o varios servicios.',
  },
  {
    from: 'properties',
    to: 'jobs',
    type: 'one-to-many',
    description: 'Un inmueble puede tener múltiples servicios programados.',
  },
  {
    from: 'jobs',
    to: 'invoices',
    type: 'one-to-one',
    description: 'Un servicio cerrado puede generar una factura.',
  },
  {
    from: 'invoices',
    to: 'payments',
    type: 'one-to-many',
    description: 'Una factura puede tener uno o varios cobros.',
  },
]
