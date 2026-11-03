import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { manifestProblems, unreleased, ZERO } from './check-manifest';
import { releaseManifest } from './release-manifest';
import { assetUrl, TARGETS } from './targets';

const current = readFileSync(new URL('../boite-plugin.json', import.meta.url), 'utf8');

describe('boite-plugin.json', () => {
  it('is accepted as it stands', () => {
    expect(manifestProblems(current)).toEqual([]);
  });

  it('refuses unknown fields, http and another feature', () => {
    const base = JSON.parse(current);
    expect(manifestProblems(JSON.stringify({ ...base, updates: {} }))).not.toEqual([]);
    expect(manifestProblems(JSON.stringify({ ...base, homepage: 'http://example.com' }))).not.toEqual([]);
    expect(manifestProblems(JSON.stringify({ ...base, provides: { gateway: {} } }))).not.toEqual([]);
  });
});

describe('releaseManifest', () => {
  it('writes the version, URLs and hashes of the executables found', () => {
    const hash = 'a'.repeat(64);
    const next = releaseManifest(current, '1.2.3', (file) => (file.includes('windows') || file.includes('apple') ? hash : null));
    const manifest = JSON.parse(next);
    expect(manifest.version).toBe('1.2.3');
    expect(Object.keys(manifest.artifacts).sort()).toEqual(['darwin-arm64', 'darwin-x64', 'win32-arm64', 'win32-x64']);
    expect(manifest.artifacts['win32-x64'].url).toBe(assetUrl(TARGETS[0]!, '1.2.3'));
    expect(manifestProblems(next)).toEqual([]);
    expect(unreleased(next)).toBe(false);
  });

  it('refuses a bad version or no executable', () => {
    expect(() => releaseManifest(current, 'v1', () => ZERO)).toThrow();
    expect(() => releaseManifest(current, '1.0.0', () => null)).toThrow();
  });
});
