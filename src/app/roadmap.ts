export type RoadmapPhaseKey =
  | 'phase_1_foundation'
  | 'phase_2_core_operations'
  | 'phase_3_admin_finance'
  | 'phase_4_automation_scale'

export type RoadmapPriority = 'high' | 'medium' | 'low'
export type RoadmapStatus = 'pending' | 'in_progress' | 'done'

export interface RoadmapItem {
  id: string
  label: string
  description: string
  priority: RoadmapPriority
  status: RoadmapStatus
}

export interface RoadmapPhase {
  key: RoadmapPhaseKey
  label: string
  description: string
  items: RoadmapItem[]
}

export const roadmap: RoadmapPhase[] = [
  {
    key: 'phase_1_foundation',
    label: 'Fase 1 — Fundación',
    description: 'Base técnica, estructura del dominio y preparación del sistema.',
    items: [
      {
        id: 'foundation_project_setup',
        label: 'Crear proyecto base',
        description: 'Proyecto React + Vite + TypeScript funcionando en VS Code.',
        priority: 'high',
        status: 'done',
      },
      {
        id: 'foundation_domain_model',
        label: 'Definir dominio',
        description: 'Módulos, entidades, relaciones, enums y reglas de negocio.',
        priority: 'high',
        status: 'done',
      },
      {
        id: 'foundation_supabase_setup',
        label: 'Preparar Supabase',
        description: 'Crear proyecto, credenciales y conexión inicial.',
        priority: 'high',
        status: 'pending',
      },
    ],
  },
  {
    key: 'phase_2_core_operations',
    label: 'Fase 2 — Operación núcleo',
    description: 'Construcción del núcleo operativo del CRM.',
    items: [
      {
        id: 'core_auth',
        label: 'Login y acceso',
        description: 'Acceso básico a la app para usuarios internos.',
        priority: 'high',
        status: 'pending',
      },
      {
        id: 'core_dashboard',
        label: 'Dashboard inicial',
        description: 'Resumen visual de la actividad principal.',
        priority: 'high',
        status: 'pending',
      },
      {
        id: 'core_leads',
        label: 'Módulo Leads',
        description: 'Captación y gestión de solicitudes entrantes.',
        priority: 'high',
        status: 'pending',
      },
      {
        id: 'core_clients_properties',
        label: 'Clientes e Inmuebles',
        description: 'Gestión base de clientes y sus ubicaciones de servicio.',
        priority: 'high',
        status: 'pending',
      },
      {
        id: 'core_quotes_jobs',
        label: 'Presupuestos y Servicios',
        description: 'Creación de presupuestos y programación de trabajos.',
        priority: 'high',
        status: 'pending',
      },
    ],
  },
  {
    key: 'phase_3_admin_finance',
    label: 'Fase 3 — Administración y finanzas',
    description: 'Facturación, cobros y visión financiera básica.',
    items: [
      {
        id: 'admin_invoices',
        label: 'Módulo Facturas',
        description: 'Emisión, estados y numeración básica.',
        priority: 'high',
        status: 'pending',
      },
      {
        id: 'admin_payments',
        label: 'Módulo Cobros',
        description: 'Registro de pagos y seguimiento de pendientes.',
        priority: 'high',
        status: 'pending',
      },
      {
        id: 'admin_kpis',
        label: 'KPIs y cierres',
        description: 'Métricas, cierres mensuales y trimestrales.',
        priority: 'medium',
        status: 'pending',
      },
    ],
  },
  {
    key: 'phase_4_automation_scale',
    label: 'Fase 4 — Automatización y escalado',
    description: 'Automatizaciones, integraciones y endurecimiento del sistema.',
    items: [
      {
        id: 'scale_documents',
        label: 'Documentos automáticos',
        description: 'PDFs, plantillas y salidas documentales profesionales.',
        priority: 'medium',
        status: 'pending',
      },
      {
        id: 'scale_notifications',
        label: 'Notificaciones',
        description: 'Recordatorios y comunicaciones automáticas.',
        priority: 'medium',
        status: 'pending',
      },
      {
        id: 'scale_observability',
        label: 'Logs y auditoría',
        description: 'Trazabilidad, control de errores y observabilidad.',
        priority: 'medium',
        status: 'pending',
      },
    ],
  },
]
