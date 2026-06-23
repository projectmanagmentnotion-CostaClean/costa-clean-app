import type {
  downloadManagerExportPackage,
  ManagerExportPackageResult,
} from './managerExportPackage'

export type ExportPackageInput = Parameters<typeof downloadManagerExportPackage>[0]

export async function downloadManagerExportPackageOnDemand(
  input: ExportPackageInput,
): Promise<ManagerExportPackageResult> {
  const { downloadManagerExportPackage } = await import('./managerExportPackage')
  return downloadManagerExportPackage(input)
}
