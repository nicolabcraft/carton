/*
 * Where Boite's core is. Inside the app, the Rust shell answers
 * `core_endpoint`: the `BOITE_CORE_URL` and `BOITE_TOKEN` Boite starts Carton
 * with, else the `core.json` Boite writes in its data folder. A page opened
 * outside the shell (`bun run dev`) takes `?core=` and `?token=` instead.
 */

export interface CoreEndpoint {
  url: string;
  token: string;
  source: 'env' | 'file' | 'query';
}

const isEndpoint = (value: unknown): value is CoreEndpoint => {
  if (!value || typeof value !== 'object') return false;
  const { url, token } = value as Record<string, unknown>;
  return typeof url === 'string' && url !== '' && typeof token === 'string' && token !== '';
};

export const inShell = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function findCore(): Promise<CoreEndpoint | null> {
  if (!inShell()) {
    const query = new URLSearchParams(location.search);
    const url = query.get('core');
    const token = query.get('token');
    return url && token ? { url, token, source: 'query' } : null;
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const found = await invoke<unknown>('core_endpoint').catch(() => null);
  return isEndpoint(found) ? found : null;
}
