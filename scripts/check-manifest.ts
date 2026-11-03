/*
 * Checks `boite-plugin.json` against the rules Boite's plugin reader applies
 * (https://github.com/beboite/boite/blob/main/docs/plugins.md, "The
 * manifest"), and that Carton provides a desktop app whose artifacts are the
 * ones `release.yml` uploads.
 *
 * `bun scripts/check-manifest.ts [path]`, `bun run check:manifest`.
 */
import { readFileSync } from 'node:fs';
import { assetUrl, TARGETS } from './targets';

export const ZERO = '0'.repeat(64);
const FIELDS = ['schema', 'id', 'name', 'version', 'description', 'homepage', 'executable', 'artifacts', 'provides'];
const PLATFORMS = TARGETS.map((target) => target.platform);
const ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const EXECUTABLE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const SHA256 = /^[0-9a-f]{64}$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasControl = (text: string) => [...text].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f);

function httpsProblem(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return 'an https URL of at most 2048 characters';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.host || url.username || url.password) return 'an https URL with a host and no credentials';
  } catch {
    return 'an https URL';
  }
  return null;
}

/** The problems with the manifest text, none when it is sound. */
export function manifestProblems(text: string, file = 'boite-plugin.json'): string[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return [`${file}: not JSON: ${error instanceof Error ? error.message : String(error)}`];
  }
  if (!isObject(raw)) return [`${file}: must be a JSON object`];
  const problems: string[] = [];
  const refuse = (field: string, expected: string) => problems.push(`${file}: ${field} must be ${expected}`);
  for (const key of Object.keys(raw)) if (!FIELDS.includes(key)) refuse(key, `one of ${FIELDS.join(', ')} (unknown field)`);
  for (const key of FIELDS) if (!(key in raw)) refuse(key, 'present');
  if (raw.schema !== 1) refuse('schema', '1');
  if (typeof raw.id !== 'string' || !ID.test(raw.id)) refuse('id', 'lowercase letters, digits and inner hyphens');
  if (raw.id !== 'carton') refuse('id', 'carton');
  for (const [field, max] of [['name', 60], ['description', 300]] as const) {
    const value = raw[field];
    if (typeof value !== 'string' || value.length < 1 || value.length > max || hasControl(value)) refuse(field, `1 to ${max} characters, no control characters`);
  }
  if (typeof raw.version !== 'string' || !VERSION.test(raw.version)) refuse('version', 'MAJOR.MINOR.PATCH');
  const homepage = httpsProblem(raw.homepage);
  if (homepage) refuse('homepage', homepage);
  if (typeof raw.executable !== 'string' || !EXECUTABLE.test(raw.executable)) refuse('executable', 'a file name without extension');
  if (raw.executable !== 'carton') refuse('executable', 'carton');
  const provides = raw.provides;
  if (!isObject(provides) || Object.keys(provides).length !== 1 || !isObject(provides.desktopApp) || Object.keys(provides.desktopApp).length !== 0) {
    refuse('provides', '{ "desktopApp": {} }');
  }
  const artifacts = raw.artifacts;
  if (!isObject(artifacts) || Object.keys(artifacts).length === 0) {
    refuse('artifacts', `an object keyed by at least one of ${PLATFORMS.join(', ')}`);
    return problems;
  }
  const hashes: string[] = [];
  for (const [platform, artifact] of Object.entries(artifacts)) {
    const field = `artifacts.${platform}`;
    const target = TARGETS.find((entry) => entry.platform === platform);
    if (!target) {
      refuse(field, 'a release target');
      continue;
    }
    if (!isObject(artifact) || Object.keys(artifact).some((key) => key !== 'url' && key !== 'sha256')) {
      refuse(field, '{ "url", "sha256" }');
      continue;
    }
    const url = httpsProblem(artifact.url);
    if (url) refuse(`${field}.url`, url);
    else if (typeof raw.version === 'string' && artifact.url !== assetUrl(target, raw.version)) refuse(`${field}.url`, assetUrl(target, raw.version));
    if (typeof artifact.sha256 !== 'string' || !SHA256.test(artifact.sha256)) refuse(`${field}.sha256`, '64 lowercase hexadecimal characters');
    else hashes.push(artifact.sha256);
  }
  if (!('win32-x64' in artifacts)) refuse('artifacts.win32-x64', 'present');
  if (hashes.includes(ZERO) && hashes.some((hash) => hash !== ZERO)) refuse('artifacts.*.sha256', 'all placeholders before a release, or all the release hashes');
  return problems;
}

/** Whether the hashes are still the placeholder the release workflow replaces. */
export function unreleased(text: string): boolean {
  const artifacts = (JSON.parse(text) as { artifacts?: Record<string, { sha256?: string }> }).artifacts ?? {};
  return Object.values(artifacts).some((artifact) => artifact.sha256 === ZERO);
}

if (import.meta.main) {
  const path = process.argv[2] ?? 'boite-plugin.json';
  const text = readFileSync(path, 'utf8');
  const problems = manifestProblems(text, path);
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) process.exit(1);
  console.log(`${path}: accepted${unreleased(text) ? ' (sha256 placeholders: the release workflow fills them)' : ''}`);
}
