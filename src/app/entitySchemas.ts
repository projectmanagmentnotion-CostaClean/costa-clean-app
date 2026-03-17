import type { DomainEntityKey } from '../types/domain'

export interface EntityFieldDefinition {
  key: string
  label: string
  type:
    | 'string'
    | 'text'
    | 'number'
    | 'boolean'
    | 'date'
    | 'datetime'
    | 'email'
    | 'phone'
    | 'currency'
    | 'enum'
    | 'relation'
  required: boolean
  description: string
  enumName?: string
}

export interface EntitySchemaDefinition {
  entity: DomainEntityKey
  label: string
  fields: EntityFieldDefinition[]
}

export const entitySchemas: EntitySchemaDefinition[] = [
  {
    entity: 'leads',
    label: 'Leads',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, description: 'Identificador único del lead.' },
      { key: 'created_at', label: 'Fecha de creación', type: 'datetime', required: true, description: 'Fecha y hora de creación.' },
      { key: 'full_name', label: 'Nombre completo', type: 'string', required: true, description: 'Nombre del contacto.' },
      { key: 'phone', label: 'Teléfono', type: 'phone', required: true, description: 'Teléfono principal del lead.' },
      { key: 'email', label: 'Email', type: 'email', required: false, description: 'Correo electrónico del lead.' },
      { key: 'service_type', label: 'Tipo de servicio', type: 'enum', required: true, description: 'Tipo de limpieza solicitada.', enumName: 'serviceTypes' },
      { key: 'property_type', label: 'Tipo de inmueble', type: 'enum', required: false, description: 'Tipo de ubicación donde se prestará el servicio.', enumName: 'propertyTypes' },
      { key: 'city', label: 'Ciudad', type: 'string', required: false, description: 'Ciudad del servicio.' },
      { key: 'postal_code', label: 'Código postal', type: 'string', required: false, description: 'Código postal del servicio.' },
      { key: 'notes', label: 'Observaciones', type: 'text', required: false, description: 'Detalles adicionales del lead.' },
      { key: 'status', label: 'Estado', type: 'enum', required: true, description: 'Estado comercial del lead.', enumName: 'leadStatuses' },
    ],
  },
  {
    entity: 'clients',
    label: 'Clientes',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, description: 'Identificador único del cliente.' },
      { key: 'created_at', label: 'Fecha de creación', type: 'datetime', required: true, description: 'Fecha y hora de alta del cliente.' },
      { key: 'full_name', label: 'Nombre / razón social', type: 'string', required: true, description: 'Nombre del cliente.' },
      { key: 'phone', label: 'Teléfono', type: 'phone', required: false, description: 'Teléfono principal.' },
      { key: 'email', label: 'Email', type: 'email', required: false, description: 'Correo principal del cliente.' },
      { key: 'tax_id', label: 'DNI/NIF/CIF', type: 'string', required: false, description: 'Documento fiscal o identificativo.' },
      { key: 'billing_address', label: 'Dirección fiscal', type: 'text', required: false, description: 'Dirección de facturación.' },
      { key: 'status', label: 'Estado', type: 'enum', required: true, description: 'Estado actual del cliente.', enumName: 'clientStatuses' },
    ],
  },
  {
    entity: 'properties',
    label: 'Inmuebles',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, description: 'Identificador único del inmueble.' },
      { key: 'client_id', label: 'Cliente', type: 'relation', required: true, description: 'Cliente propietario o asociado.' },
      { key: 'name', label: 'Nombre interno', type: 'string', required: true, description: 'Nombre corto del inmueble.' },
      { key: 'property_type', label: 'Tipo de inmueble', type: 'enum', required: true, description: 'Piso, casa, oficina, local, etc.', enumName: 'propertyTypes' },
      { key: 'address', label: 'Dirección', type: 'text', required: true, description: 'Dirección completa del inmueble.' },
      { key: 'city', label: 'Ciudad', type: 'string', required: false, description: 'Ciudad del inmueble.' },
      { key: 'postal_code', label: 'Código postal', type: 'string', required: false, description: 'Código postal del inmueble.' },
      { key: 'notes', label: 'Notas operativas', type: 'text', required: false, description: 'Instrucciones, accesos o detalles.' },
    ],
  },
  {
    entity: 'quotes',
    label: 'Presupuestos',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, description: 'Identificador único del presupuesto.' },
      { key: 'client_id', label: 'Cliente', type: 'relation', required: true, description: 'Cliente del presupuesto.' },
      { key: 'property_id', label: 'Inmueble', type: 'relation', required: false, description: 'Inmueble asociado.' },
      { key: 'created_at', label: 'Fecha de creación', type: 'datetime', required: true, description: 'Fecha de creación del presupuesto.' },
      { key: 'status', label: 'Estado', type: 'enum', required: true, description: 'Estado comercial del presupuesto.', enumName: 'quoteStatuses' },
      { key: 'subtotal', label: 'Subtotal', type: 'currency', required: true, description: 'Base del presupuesto antes de impuestos.' },
      { key: 'tax_amount', label: 'IVA', type: 'currency', required: false, description: 'Importe del impuesto.' },
      { key: 'total', label: 'Total', type: 'currency', required: true, description: 'Importe total.' },
      { key: 'notes', label: 'Notas', type: 'text', required: false, description: 'Condiciones o comentarios.' },
    ],
  },
  {
    entity: 'jobs',
    label: 'Servicios',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, description: 'Identificador único del servicio.' },
      { key: 'client_id', label: 'Cliente', type: 'relation', required: true, description: 'Cliente vinculado al servicio.' },
      { key: 'property_id', label: 'Inmueble', type: 'relation', required: true, description: 'Ubicación del servicio.' },
      { key: 'quote_id', label: 'Presupuesto', type: 'relation', required: false, description: 'Presupuesto origen si existe.' },
      { key: 'scheduled_date', label: 'Fecha programada', type: 'date', required: true, description: 'Fecha del servicio.' },
      { key: 'status', label: 'Estado', type: 'enum', required: true, description: 'Estado operativo del servicio.', enumName: 'jobStatuses' },
      { key: 'service_type', label: 'Tipo de servicio', type: 'enum', required: true, description: 'Tipo de trabajo programado.', enumName: 'serviceTypes' },
      { key: 'notes', label: 'Notas', type: 'text', required: false, description: 'Detalles internos del servicio.' },
    ],
  },
  {
    entity: 'invoices',
    label: 'Facturas',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, description: 'Identificador único de la factura.' },
      { key: 'job_id', label: 'Servicio', type: 'relation', required: true, description: 'Servicio facturado.' },
      { key: 'client_id', label: 'Cliente', type: 'relation', required: true, description: 'Cliente facturado.' },
      { key: 'invoice_number', label: 'Número de factura', type: 'string', required: true, description: 'Número o serie de factura.' },
      { key: 'issue_date', label: 'Fecha de emisión', type: 'date', required: true, description: 'Fecha de emisión.' },
      { key: 'status', label: 'Estado', type: 'enum', required: true, description: 'Estado administrativo de la factura.', enumName: 'invoiceStatuses' },
      { key: 'subtotal', label: 'Subtotal', type: 'currency', required: true, description: 'Base imponible.' },
      { key: 'tax_amount', label: 'IVA', type: 'currency', required: true, description: 'Importe del impuesto.' },
      { key: 'total', label: 'Total', type: 'currency', required: true, description: 'Importe total de la factura.' },
    ],
  },
  {
    entity: 'payments',
    label: 'Cobros',
    fields: [
      { key: 'id', label: 'ID', type: 'string', required: true, description: 'Identificador único del cobro.' },
      { key: 'invoice_id', label: 'Factura', type: 'relation', required: true, description: 'Factura asociada al cobro.' },
      { key: 'payment_date', label: 'Fecha de cobro', type: 'date', required: true, description: 'Fecha en la que se recibió el pago.' },
      { key: 'amount', label: 'Importe', type: 'currency', required: true, description: 'Cantidad cobrada.' },
      { key: 'payment_method', label: 'Método de pago', type: 'enum', required: false, description: 'Transferencia, efectivo, Bizum, etc.', enumName: 'paymentMethods' },
      { key: 'notes', label: 'Notas', type: 'text', required: false, description: 'Observaciones del cobro.' },
    ],
  },
]
