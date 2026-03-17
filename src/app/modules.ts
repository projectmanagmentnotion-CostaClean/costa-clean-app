import type { AppModuleDefinition } from '../types/app'

export const appModules: AppModuleDefinition[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Resumen general del negocio y actividad reciente.',
    enabled: true,
    phase: 'v1',
  },
  {
    key: 'leads',
    label: 'Leads',
    description: 'Solicitudes entrantes y seguimiento comercial.',
    enabled: true,
    phase: 'v1',
  },
  {
    key: 'clients',
    label: 'Clientes',
    description: 'Base maestra de clientes reales.',
    enabled: true,
    phase: 'v1',
  },
  {
    key: 'properties',
    label: 'Inmuebles',
    description: 'Pisos, viviendas, oficinas o ubicaciones de servicio.',
    enabled: true,
    phase: 'v1',
  },
  {
    key: 'quotes',
    label: 'Presupuestos',
    description: 'Propuestas comerciales y líneas de presupuesto.',
    enabled: true,
    phase: 'v1',
  },
  {
    key: 'jobs',
    label: 'Servicios',
    description: 'Trabajos programados, ejecución y estado operativo.',
    enabled: true,
    phase: 'v1',
  },
  {
    key: 'invoices',
    label: 'Facturas',
    description: 'Emisión, control y estado de facturación.',
    enabled: true,
    phase: 'v2',
  },
  {
    key: 'payments',
    label: 'Cobros',
    description: 'Registro de pagos y seguimiento de pendientes.',
    enabled: true,
    phase: 'v2',
  },
  {
    key: 'kpis',
    label: 'KPIs',
    description: 'Panel de métricas y cierres trimestrales.',
    enabled: true,
    phase: 'v2',
  },
  {
    key: 'settings',
    label: 'Ajustes',
    description: 'Configuración general, parámetros y datos de empresa.',
    enabled: true,
    phase: 'v1',
  },
]
