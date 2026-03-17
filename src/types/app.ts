export type AppEnvironment = 'local' | 'development' | 'staging' | 'production'

export interface AppConfig {
  appName: string
  appVersion: string
  environment: AppEnvironment
}

export type AppModuleKey =
  | 'dashboard'
  | 'leads'
  | 'clients'
  | 'properties'
  | 'quotes'
  | 'jobs'
  | 'invoices'
  | 'payments'
  | 'kpis'
  | 'settings'

export interface AppModuleDefinition {
  key: AppModuleKey
  label: string
  description: string
  enabled: boolean
  phase: 'v1' | 'v2'
}
