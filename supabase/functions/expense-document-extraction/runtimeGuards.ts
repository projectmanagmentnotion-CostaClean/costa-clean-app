export const QA_PROJECT_REF = 'kpvvydthlxupjjqqdpxy'
export const SERVER_FIXTURE_ENV_NAME = 'N52_SERVER_FIXTURE_MODE'

export const isQaFixtureRuntimeConfigured = (supabaseUrl: string, fixtureMode: string) => {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0] === QA_PROJECT_REF && fixtureMode === 'qa-fixture'
  } catch {
    return false
  }
}
