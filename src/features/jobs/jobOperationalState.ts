import type { JobListItem } from './types'

export type JobOperationalState = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'review' | 'cancelled'

export interface JobOperationalStatus {
  state: JobOperationalState
  label: string
}

export function getJobOperationalStatus(job: JobListItem, today: string): JobOperationalStatus {
  if (job.status === 'cancelled' || job.cancelled_at) {
    return { state: 'cancelled', label: 'Cancelado' }
  }

  if (job.status === 'completed') {
    return { state: 'completed', label: 'Realizado' }
  }

  if (job.scheduled_date < today && (job.status === 'scheduled' || job.status === 'pending' || job.status === 'in_progress')) {
    return { state: 'review', label: 'Necesita revision' }
  }

  if (job.status === 'in_progress') {
    return { state: 'in_progress', label: 'En curso' }
  }

  if (job.status === 'pending') {
    return { state: 'pending', label: 'Pendiente' }
  }

  return { state: 'scheduled', label: 'Programado' }
}

export function isUpcomingJob(job: JobListItem, today: string): boolean {
  const status = getJobOperationalStatus(job, today)
  return (status.state === 'scheduled' || status.state === 'pending' || status.state === 'in_progress')
    && job.scheduled_date >= today
}
