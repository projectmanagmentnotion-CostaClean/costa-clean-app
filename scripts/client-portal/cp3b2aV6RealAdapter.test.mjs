import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AUTHORIZATION_ID_V6R1E,
  GATE_V6R1E,
  MIGRATION_SHA256,
  PACKAGE_STATUS_V6R1E,
  QA_REF,
  SOURCE_BASE_HEAD_V6R1E,
  assertPackageWorkingTreeIntegrityV6,
  assertExecutionAuthorizationV6,
  buildExecutionOperationsV6,
  planV6,
  preflightV6,
  preflightReadOnlyV6,
  rawWorkingTreeBlobIdV6,
  verifyPackageManifestV6,
} from './run-cp3b2a-qa-v6.mjs'

const AUTHORIZED_COMMIT = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()

function environment() {
  return {
    CP3B2A_PROJECT_REF: QA_REF,
    CP3B2A_V6R1E_AUTHORIZATION_ID: AUTHORIZATION_ID_V6R1E,
    CP3B2A_V6R1E_AUTHORIZED_HEAD: SOURCE_BASE_HEAD_V6R1E,
    CP3B2A_V6R1E_AUTHORIZED_COMMIT: AUTHORIZED_COMMIT,
    CP3B2A_V6R1E_EXECUTION_AUTHORIZED: 'false',
  }
}

function integrityProbe({ flagPath = null, flag = 'H', divergencePath = null, stagedPath = null } = {}) {
  const git = (args) => {
    const relativePath = args.at(-1)
    if (args[0] === 'ls-files') return `${relativePath === flagPath ? flag : 'H'} ${relativePath}`
    if (args[0] === 'diff' && args[1] === '--cached') return relativePath === stagedPath ? relativePath : ''
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') return AUTHORIZED_COMMIT
    if (args[0] === 'rev-parse' && args[1].startsWith(`${AUTHORIZED_COMMIT}:`)) return 'a'.repeat(40)
    throw new Error(`unexpected git probe: ${args.join(' ')}`)
  }
  const worktreeBlobId = (filePath) => (
    filePath.replaceAll('\\', '/').endsWith(`/${divergencePath}`) ? 'b'.repeat(40) : 'a'.repeat(40)
  )
  return { git, worktreeBlobId, worktreeSha256: () => MIGRATION_SHA256 }
}

describe('CP-3B.2A.6R.1E final real PostgreSQL adapter', () => {
  it.each([
    ['assume-unchanged metadata', 'scripts/client-portal/cp3b2a_qa_package_v6.manifest.json', 'h', 'V6_PACKAGE_WORKTREE_METADATA_REJECTED'],
    ['skip-worktree metadata', 'scripts/client-portal/cp3b2a_qa_package_v6.manifest.json', 'S', 'V6_PACKAGE_WORKTREE_METADATA_REJECTED'],
    ['staged byte divergence', 'scripts/client-portal/cp3b2a_qa_matrix_v6.sql', 'H', 'V6_PACKAGE_INDEX_DIVERGENCE'],
    ['artifact byte divergence', 'scripts/client-portal/cp3b2a_qa_matrix_v6.sql', 'H', 'V6_PACKAGE_WORKTREE_DIVERGENCE'],
    ['manifest byte divergence', 'scripts/client-portal/cp3b2a_qa_package_v6.manifest.json', 'H', 'V6_PACKAGE_WORKTREE_DIVERGENCE'],
  ])('rejects %s before package trust', (_label, targetPath, flag, expectedCode) => {
    const probe = integrityProbe({
      flagPath: flag === 'H' && expectedCode === 'V6_PACKAGE_WORKTREE_DIVERGENCE' ? null : targetPath,
      flag,
      stagedPath: expectedCode === 'V6_PACKAGE_INDEX_DIVERGENCE' ? targetPath : null,
      divergencePath: expectedCode === 'V6_PACKAGE_WORKTREE_DIVERGENCE' ? targetPath : null,
    })
    expect(() => assertPackageWorkingTreeIntegrityV6(AUTHORIZED_COMMIT, probe)).toThrow(expectedCode)
  })

  it('derives the worktree blob identity from raw bytes, independent of clean filters', () => {
    const filePath = path.join(process.cwd(), 'scripts/client-portal/cp3b2a_qa_matrix_v6.sql')
    const noFilter = spawnSync('git', ['hash-object', '--no-filters', '--', filePath], {
      encoding: 'utf8',
    })
    expect(noFilter.status).toBe(0)
    expect(rawWorkingTreeBlobIdV6(filePath)).toBe(noFilter.stdout.trim())
  })

  it('exposes the V6R1E package contract', { timeout: 15_000 }, () => {
    const { manifest } = verifyPackageManifestV6(AUTHORIZED_COMMIT)
    expect(manifest.gate).toBe(GATE_V6R1E)
    expect(manifest.status).toBe(PACKAGE_STATUS_V6R1E)
    expect(manifest.authorizationId).toBe(AUTHORIZATION_ID_V6R1E)
    expect(manifest.sourceBaseHead).toBe(SOURCE_BASE_HEAD_V6R1E)
  })

  it('keeps read-only plan and preflight usable without execution authorization', { timeout: 15_000 }, () => {
    const plan = planV6({})
    expect(plan.mode).toBe('plan')
    expect(plan.authorizedCommit).toBe(AUTHORIZED_COMMIT)
    const readOnly = preflightReadOnlyV6({}, {
      gitState: (authorizedCommit) => ({
        branch: 'main',
        head: authorizedCommit,
        remoteHead: authorizedCommit,
        clean: true,
        divergence: [0, 0],
      }),
    })
    expect(readOnly.gitState.authorizedCommit).toBeUndefined()
    expect(readOnly.gitState.head).toBe(AUTHORIZED_COMMIT)
  })

  it('revalidates the capability map immediately before consuming it', () => {
    const seen = []
    const expectedError = new Error('V6_CAPABILITY_MAP_TOCTOU')
    expect(() => preflightV6(environment(), {
      gitState: () => ({
        branch: 'main',
        head: AUTHORIZED_COMMIT,
        remoteHead: AUTHORIZED_COMMIT,
        clean: true,
        divergence: [0, 0],
      }),
      assertQaTarget: () => ({ target: 'QA_MATCH', tls: 'REQUIRED', adapter: 'POSTGRESQL_17' }),
      assertProductionRejected: () => true,
      verifyFileBackedStage: (filePath) => {
        const normalized = filePath.replaceAll('\\', '/')
        seen.push(normalized)
        if (normalized.endsWith('cp3b2a_qa_capability_map_v6.json')) throw expectedError
      },
    })).toThrow(expectedError)
    expect(seen.some((filePath) => filePath.endsWith('cp3b2a_qa_capability_map_v6.json'))).toBe(true)
  })

  it('keeps plan/preflight read-only', { timeout: 30_000 }, () => {
    const plan = planV6(environment())
    expect(plan.gate).toBe(GATE_V6R1E)
    expect(plan.qaApplication).toBe('READY_PENDING_EXPLICIT_V6R1E_AUTHORIZATION')
    const preflight = preflightV6(environment(), {
      gitState: () => ({
        branch: 'main',
        head: SOURCE_BASE_HEAD_V6R1E,
        remoteHead: SOURCE_BASE_HEAD_V6R1E,
        clean: true,
        divergence: [0, 0],
      }),
      assertQaTarget: () => ({ target: 'QA_MATCH', tls: 'REQUIRED', adapter: 'POSTGRESQL_17' }),
      assertProductionRejected: () => true,
      createPrivateBackup: () => ({
        path: '/tmp/private-backup-v6r1e-manifest.json',
        value: { liveSnapshot: { contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, collisions: { combinedDuplicatePairs: 0 } } },
      }),
      verifyPrivateBackup: () => ({
        path: '/tmp/private-backup-v6r1e-manifest.json',
        value: { liveSnapshot: { contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, collisions: { combinedDuplicatePairs: 0 } } },
      }),
      readLivePrestate: () => ({ contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, collisions: { combinedDuplicatePairs: 0 } }),
      readDriftSentinel: () => ({ contract: { presentFunctions: 0, presentConstraints: 0, presentIndexes: 0 }, collisions: { combinedDuplicatePairs: 0 } }),
    })
    expect(preflight.verdict).toBe('READY_FOR_CP3B2A_QA_V6R1E')
    expect(preflight.backupLiveExactComparison).toBe('PASS')
    expect(preflight.driftSentinel).toBe('PASS')
  })

  it('rejects execute without the explicit V6R1E authorization', () => {
    expect(() => assertExecutionAuthorizationV6({}, SOURCE_BASE_HEAD_V6R1E))
      .toThrow('V6R_EXECUTION_NOT_AUTHORIZED')
  })

  it('rejects HEAD movement after authorization', () => {
    const authorizedCommit = 'a'.repeat(40)
    const git = (args) => {
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') return 'b'.repeat(40)
      throw new Error(`unexpected git probe: ${args.join(' ')}`)
    }
    expect(() => assertPackageWorkingTreeIntegrityV6(authorizedCommit, { git }))
      .toThrow('V6_AUTHORIZED_COMMIT_MOVED')
  })

  it('revalidates every file-backed stage immediately before use', () => {
    const seen = []
    const operations = buildExecutionOperationsV6({
      ...environment(),
      CP3B2A_V6R1E_PRIVATE_BACKUP_MANIFEST: 'C:\\tmp\\cp3b2a-v6r1e-backup.json',
    }, {
      runPsql: () => { throw new Error('runPsql must not be reached') },
      verifyFileBackedStage: (filePath) => {
        seen.push(filePath.replaceAll('\\', '/'))
        throw new Error('V6_FILE_BACKED_STAGE_TOCTOU')
      },
    })
    const state = { runId: 'CP3B2A-V6R1E-TOCTOU123456' }
    const stages = [
      operations.apply,
      operations.postcheck,
      operations.transactionalMatrix,
      operations.fixtureSetup,
      operations.concurrentMatrix,
      operations.fixtureCleanup,
      operations.executeRollback,
      operations.finalPostcheck,
      operations.finalDigestComparison,
    ]
    for (const stage of stages) expect(() => stage(state)).toThrow('V6_FILE_BACKED_STAGE_TOCTOU')
    expect(seen.join('\n')).toMatch(/20260728160000_portal_reviewed_change_contract\.sql/u)
    expect(seen.join('\n')).toMatch(/cp3b2a_qa_postcheck_v6\.sql/u)
    expect(seen.join('\n')).toMatch(/cp3b2a_qa_matrix_v6\.sql/u)
    expect(seen.join('\n')).toMatch(/cp3b2a_qa_fixture_setup_v6\.sql/u)
    expect(seen.join('\n')).toMatch(/cp3b2a_qa_concurrency_v6\.mjs/u)
    expect(seen.join('\n')).toMatch(/cp3b2a_qa_fixture_cleanup_v6\.sql/u)
    expect(seen.join('\n')).toMatch(/cp3b2a_qa_rollback_v6\.sql/u)
    expect(seen.join('\n')).toMatch(/cp3b2a_qa_digest_v6\.sql/u)
  })

  it('builds file-backed execution operations for the reviewed contract', () => {
    const calls = []
    const liveSnapshot = {
      gate: GATE_V6R1E,
      projectRef: QA_REF,
      authorizedHead: SOURCE_BASE_HEAD_V6R1E,
      sourceBaseHead: SOURCE_BASE_HEAD_V6R1E,
      postgresMajor: 17,
      contract: {
        expectedFunctions: 7,
        presentFunctions: 0,
        expectedConstraints: 2,
        presentConstraints: 0,
        expectedIndexes: 4,
        presentIndexes: 0,
      },
      prestate: {
        profileRows: 2,
        propertyRows: 3,
      },
      collisions: {
        profileDuplicatePairs: 0,
        propertyDuplicatePairs: 0,
        combinedDuplicatePairs: 0,
      },
    }
    const operations = buildExecutionOperationsV6({
      CP3B2A_PROJECT_REF: QA_REF,
      CP3B2A_V6R1E_AUTHORIZATION_ID: AUTHORIZATION_ID_V6R1E,
      CP3B2A_V6R1E_AUTHORIZED_HEAD: SOURCE_BASE_HEAD_V6R1E,
      CP3B2A_V6R1E_AUTHORIZED_COMMIT: AUTHORIZED_COMMIT,
      CP3B2A_V6R1E_EXECUTION_AUTHORIZED: 'false',
      CP3B2A_V6R1E_PRIVATE_BACKUP_MANIFEST: 'C:\\Users\\USUARIO\\costa-clean-app\\.project-agent\\private\\cp3b2a-v6r1e\\test-backup.json',
      CP2B_QA_DATABASE_URL: 'postgres://qa.example.invalid/postgres',
      PORTAL_ALLOWED_ORIGIN: 'https://app.costacleanbcn.com',
    }, {
      runId: 'CP3B2A-V6R1E-ABCDEF123456',
      runPsql: (sql, options = {}) => {
        calls.push({
          sql: typeof sql === 'string' ? sql : '',
          filePath: options.filePath ?? null,
        })
        return { rows: [], rowCount: 0, output: '' }
      },
      gitState: () => ({
        branch: 'main',
        head: SOURCE_BASE_HEAD_V6R1E,
        remoteHead: SOURCE_BASE_HEAD_V6R1E,
        clean: true,
        divergence: [0, 0],
      }),
      readLiveSnapshot: () => ({
        ...liveSnapshot,
      }),
      onConcurrentStage: () => {},
      onInventory: () => {},
    })
    expect(operations.apply).toBeInstanceOf(Function)
    expect(operations.concurrentMatrix).toBeInstanceOf(Function)
    expect(operations.fixtureCleanupConfirmed).toBeInstanceOf(Function)
    const applyResult = operations.apply({
      runId: 'CP3B2A-V6R1E-ABCDEF123456',
      gitState: {
        head: SOURCE_BASE_HEAD_V6R1E,
      },
      backup: {
        value: {
          liveSnapshot: {
            contract: { expectedFunctions: 7, presentFunctions: 0, expectedConstraints: 2, presentConstraints: 0, expectedIndexes: 4, presentIndexes: 0 },
            prestate: { profileRows: 2, propertyRows: 3 },
            collisions: { profileDuplicatePairs: 0, propertyDuplicatePairs: 0, combinedDuplicatePairs: 0 },
          },
        },
      },
    })
    expect(applyResult.applyState).toBe('NOT_APPLIED_CONFIRMED')
    expect(calls.some((call) => call.filePath?.endsWith('20260728160000_portal_reviewed_change_contract.sql'))).toBe(true)
  })
})
