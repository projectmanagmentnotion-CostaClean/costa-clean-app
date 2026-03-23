import type { AppView } from '../../app/navigation'

export interface DashboardMetrics {
  leadsCount: number
  clientsCount: number
  propertiesCount: number
  quotesCount: number
  jobsCount: number
  invoicesCount: number
  paymentsCount: number
  openQuotesCount: number
  scheduledJobsCount: number
  pendingInvoicesCount: number
  totalInvoiced: number
  totalCollected: number
}

export interface HomePageProps {
  metrics: DashboardMetrics
  connectionStatus: string
  connectionDetail: string
}

export interface DashboardQuickActionItem {
  title: string
  description: string
  view: AppView
  emphasis?: 'primary' | 'neutral'
}
