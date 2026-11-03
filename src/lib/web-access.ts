/*
 * Boite in a web browser. The core serves its own web app at its address;
 * `pairing.grant` mints a one-time link (`?grant=`, valid ten minutes, spent
 * on first use) that signs a browser in without ever handing it the core
 * token. On this computer Carton opens the loopback address with an owner
 * grant; for another device it gives the core's own link, a device grant on
 * the address the core is reached at from the network.
 */

export interface PairingGrant {
  url: string;
  grant: string;
  role: 'device' | 'owner';
  expiresAt: number;
}

/** The core's web page on this computer, signed in by `grant`. */
export function localLink(coreUrl: string, grant: string): string {
  const url = new URL(coreUrl);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  url.searchParams.set('grant', grant);
  return url.toString();
}

/** Whether a link only works on this computer (a loopback host). */
export function isLoopback(link: string): boolean {
  const host = new URL(link).hostname;
  return host === 'localhost' || host === '[::1]' || host === '::1' || /^127\./.test(host);
}

/** Seconds left before the grant expires, never below 0. */
export function secondsLeft(grant: Pick<PairingGrant, 'expiresAt'>, now: number): number {
  return Math.max(0, Math.round((grant.expiresAt - now) / 1000));
}
