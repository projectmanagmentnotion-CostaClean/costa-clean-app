import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

const root = process.cwd();
const manifestPath = path.join(root, 'release', 'n2-n9-rc1.manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const rc2ManifestPath = path.join(root, 'release', 'n2-n9-rc2.manifest.json');

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
