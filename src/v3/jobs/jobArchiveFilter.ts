import type { JobListItem } from '../../features/jobs/types'

export function filterJobsForArchiveTab(jobs: JobListItem[], archivedTab: boolean): JobListItem[] {
  return jobs.filter((job) => Boolean(job.archived_at || job.deleted_at) === archivedTab)
}
