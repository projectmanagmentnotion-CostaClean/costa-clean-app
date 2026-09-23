import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

const root = process.cwd();
const manifestPath = path.join(root, 'release', 'n2-n9-rc1.manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const rc2ManifestPath = path.join(root, 'release', 'n2-n9-rc2.manifest.json');
const rc3ManifestPath = path.join(root, 'release', 'n2-n9-rc3.manifest.json');

test('RC1 manifest freezes the exact ordered N2-N9 migration chain and hashes', () => {
  expect(manifest.migrations.map((migration) => migration.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  for (const migration of manifest.migrations) {
    const filePath = path.join(root, 'supabase', 'migrations', migration.filename);
    expect(fs.existsSync(filePath), `${migration.filename} must exist`).toBe(true);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    expect(hash, `${migration.filename} hash drifted`).toBe(migration.sha256);
  }
});

test('RC1 manifest is anchored to the certified source head without circular self-hashing', () => {
  expect(manifest.source_head).toMatch(/^[0-9a-f]{40}$/);
  execFileSync('git', ['merge-base', '--is-ancestor', manifest.source_head, 'HEAD'], { cwd: root, stdio: 'ignore' });
  expect(manifest.head_policy).toBe('source_head_is_ancestor_of_current_head');
  expect(manifest.runtime_policy).toContain('production mutation');
});

test('RC1 manifest records additive scope and N3 source-of-truth boundary', () => {
  expect(manifest.scope).toEqual(['N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9']);
  expect(manifest.n3.migration).toBe('none');
  expect(manifest.migrations.every((migration) => migration.change_class === 'additive')).toBe(true);
  expect(manifest.migrations.every((migration) => migration.rollback === 'forward corrective migration only')).toBe(true);
});

test('RC2 preserves all RC1 migration hashes and freezes one forward correction', () => {
  const rc2 = JSON.parse(fs.readFileSync(rc2ManifestPath, 'utf8'));
  expect(rc2.release).toBe('N2-N9-RC2');
  expect(rc2.migrations).toHaveLength(8);
  expect(rc2.migrations.slice(0, 7).map((migration) => migration.filename)).toEqual(manifest.migrations.map((migration) => migration.filename));
  expect(rc2.migrations.slice(0, 7).map((migration) => migration.sha256)).toEqual(manifest.migrations.map((migration) => migration.sha256));
  const correction = rc2.migrations[7];
  expect(correction.filename).toBe('20260923220000_n9_fix_team_workload_forecast_aggregate.sql');
  const correctionPath = path.join(root, 'supabase', 'migrations', correction.filename);
  expect(fs.existsSync(correctionPath)).toBe(true);
  expect(crypto.createHash('sha256').update(fs.readFileSync(correctionPath)).digest('hex')).toBe(correction.sha256);
  expect(rc2.head_policy).toBe('source_head_is_ancestor_of_current_head');
});

test('RC3 fresh-install manifest selects the replacement N9 and excludes unreachable historical artifacts', () => {
  const rc3 = JSON.parse(fs.readFileSync(rc3ManifestPath, 'utf8'));
  expect(rc3.release).toBe('N2-N9-RC3');
  expect(rc3.migration_count).toBe(7);
  expect(rc3.migrations.map((migration) => migration.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(rc3.migrations.slice(0, 6).map((migration) => migration.filename)).toEqual(manifest.migrations.slice(0, 6).map((migration) => migration.filename));
  expect(rc3.migrations.slice(0, 6).map((migration) => migration.sha256)).toEqual(manifest.migrations.slice(0, 6).map((migration) => migration.sha256));
  expect(rc3.migrations.at(-1).filename).toBe('20260923230000_n9_recurring_operational_templates_v2.sql');
  expect(rc3.migrations.map((migration) => migration.filename)).not.toContain('20260923210000_n9_recurring_operational_templates.sql');
  expect(rc3.migrations.map((migration) => migration.filename)).not.toContain('20260923220000_n9_fix_team_workload_forecast_aggregate.sql');
  expect(rc3.superseded_runtime_artifacts).toEqual([
    { filename: '20260923210000_n9_recurring_operational_templates.sql', reason: 'DO_NOT_EXECUTE_IN_RC3_FRESH_INSTALL' },
    { filename: '20260923220000_n9_fix_team_workload_forecast_aggregate.sql', reason: 'DO_NOT_EXECUTE_IN_RC3_FRESH_INSTALL' },
  ]);
});

test('RC3 manifest freezes the replacement N9 hash and preserves RC1/RC2 artifacts', () => {
  const rc2 = JSON.parse(fs.readFileSync(rc2ManifestPath, 'utf8'));
  const rc3 = JSON.parse(fs.readFileSync(rc3ManifestPath, 'utf8'));
  const v2 = rc3.migrations.at(-1);
  const v2Path = path.join(root, 'supabase', 'migrations', v2.filename);
  expect(fs.existsSync(v2Path)).toBe(true);
  expect(v2.sha256).toMatch(/^[0-9a-f]{64}$/u);
  expect(crypto.createHash('sha256').update(fs.readFileSync(v2Path)).digest('hex')).toBe(v2.sha256);
  for (const historical of [manifest.migrations.at(-1), rc2.migrations.at(-1)]) {
    const historicalPath = path.join(root, 'supabase', 'migrations', historical.filename);
    expect(crypto.createHash('sha256').update(fs.readFileSync(historicalPath)).digest('hex')).toBe(historical.sha256);
  }
});
