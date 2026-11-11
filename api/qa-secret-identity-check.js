import { verifyQaSecretIdentity } from './_lib/qaSecretIdentityCheck.js'

/**
 * Keep this route on a Vercel Preview protected by Deployment Protection / SSO.
 * The platform is the caller-authentication boundary; this route adds strict
 * project, branch, environment, and QA-target guards before using the secret.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  const verified = await verifyQaSecretIdentity({
    method: req?.method,
    env: process.env,
    fetchImpl: globalThis.fetch,
  })

  return res.status(200).json(verified)
}
