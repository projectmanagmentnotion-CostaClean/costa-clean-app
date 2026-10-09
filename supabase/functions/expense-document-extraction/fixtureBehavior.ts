export type FixtureFailure = 'EXTRACTION_PROVIDER_UNAVAILABLE' | null

export const getFixtureFailure = (originalFilename: string, serverAttempt: number): FixtureFailure => {
  const filename = originalFilename.toLowerCase()
  if (filename.startsWith('fixture-fail-once-')) return serverAttempt === 1 ? 'EXTRACTION_PROVIDER_UNAVAILABLE' : null
  if (filename.startsWith('fixture-fail-always-') || filename.startsWith('fixture-fail-')) return 'EXTRACTION_PROVIDER_UNAVAILABLE'
  return null
}
