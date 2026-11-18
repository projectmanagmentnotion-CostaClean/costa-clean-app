export const QA_PROJECT_REF = 'kpvvydthlxupjjqqdpxy'
export const SERVER_FIXTURE_ENV_NAME = 'N52_SERVER_FIXTURE_MODE'

export const isQaFixtureRuntimeConfigured = (supabaseUrl: string, fixtureMode: string) => {
  try {
    const url = new URL(supabaseUrl)
    return url.origin === `https://${QA_PROJECT_REF}.supabase.co`
      && url.pathname === '/'
      && !url.search
      && !url.hash
      && fixtureMode === 'qa-fixture'
  } catch {
    return false
  }
}
