import { describe, expect, it } from 'vitest';
import { isLoopback, localLink, secondsLeft } from './web-access';

describe('localLink', () => {
  it('points at the core root with the grant alone', () => {
    expect(localLink('http://127.0.0.1:7337', 'abc')).toBe('http://127.0.0.1:7337/?grant=abc');
    expect(localLink('http://127.0.0.1:7337/rpc?token=x#y', 'abc')).toBe('http://127.0.0.1:7337/?grant=abc');
  });
});

describe('isLoopback', () => {
  it('tells this computer from the network', () => {
    expect(isLoopback('http://127.0.0.1:7337/?grant=a')).toBe(true);
    expect(isLoopback('http://localhost:7337/')).toBe(true);
    expect(isLoopback('http://[::1]:7337/')).toBe(true);
    expect(isLoopback('http://192.168.1.7:7337/?grant=a')).toBe(false);
    expect(isLoopback('https://boite.example.com/?grant=a')).toBe(false);
  });
});

describe('secondsLeft', () => {
  it('counts down to zero', () => {
    expect(secondsLeft({ expiresAt: 10_000 }, 0)).toBe(10);
    expect(secondsLeft({ expiresAt: 10_000 }, 20_000)).toBe(0);
  });
});
