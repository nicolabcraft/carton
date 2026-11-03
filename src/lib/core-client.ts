/*
 * A small JSON-RPC 2.0 client for Boite's core, over the WebSocket at
 * `<core>/rpc` (protocol 2). It says `hello` with the owner token as a
 * `plugin` client, the name a desktop-app plugin uses, then sends calls and
 * hands events to listeners. When the socket drops it reconnects by itself,
 * waiting 1, 2, 5 then 10 seconds.
 */

export const PROTOCOL_VERSION = 2;
const RETRY_MS = [1_000, 2_000, 5_000, 10_000];
const CALL_TIMEOUT_MS = 60_000;

export type ConnectionState = 'connecting' | 'ready' | 'closed';

export class RpcError extends Error {
  constructor(
    readonly code: number,
    message: string
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type Listener = (params: unknown) => void;

export interface CoreClientOptions {
  url: string;
  token: string;
  version: string;
  /** Tests pass a fake socket. */
  socket?: (url: string) => WebSocket;
}

/** `http://host:port` to `ws://host:port/rpc`. */
export function rpcUrl(coreUrl: string): string {
  const url = new URL(coreUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/rpc';
  url.search = '';
  return url.toString();
}

export class CoreClient {
  #options: CoreClientOptions;
  #socket: WebSocket | null = null;
  #nextId = 1;
  #pending = new Map<number, Pending>();
  #listeners = new Map<string, Set<Listener>>();
  #stateListeners = new Set<(state: ConnectionState, error?: string) => void>();
  #attempt = 0;
  #stopped = false;
  #retry: ReturnType<typeof setTimeout> | null = null;
  state: ConnectionState = 'closed';

  constructor(options: CoreClientOptions) {
    this.#options = options;
  }

  start(): void {
    this.#stopped = false;
    this.#open();
  }

  stop(): void {
    this.#stopped = true;
    if (this.#retry) clearTimeout(this.#retry);
    this.#socket?.close();
    this.#socket = null;
    this.#setState('closed');
  }

  onState(listener: (state: ConnectionState, error?: string) => void): () => void {
    this.#stateListeners.add(listener);
    return () => this.#stateListeners.delete(listener);
  }

  on(event: string, listener: Listener): () => void {
    const set = this.#listeners.get(event) ?? new Set();
    set.add(listener);
    this.#listeners.set(event, set);
    return () => set.delete(listener);
  }

  call<T>(method: string, params: unknown = {}): Promise<T> {
    if (this.state !== 'ready') return Promise.reject(new Error('Boite is not connected'));
    return this.#send<T>(method, params);
  }

  #send<T>(method: string, params: unknown): Promise<T> {
    const socket = this.#socket;
    if (!socket) return Promise.reject(new Error('Boite is not connected'));
    const id = this.#nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`${method} took more than ${CALL_TIMEOUT_MS / 1000} s`));
      }, CALL_TIMEOUT_MS);
      this.#pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  #setState(state: ConnectionState, error?: string): void {
    this.state = state;
    for (const listener of this.#stateListeners) listener(state, error);
  }

  #open(): void {
    this.#setState('connecting');
    const make = this.#options.socket ?? ((url: string) => new WebSocket(url));
    let socket: WebSocket;
    try {
      socket = make(rpcUrl(this.#options.url));
    } catch (error) {
      this.#scheduleRetry(error instanceof Error ? error.message : String(error));
      return;
    }
    this.#socket = socket;
    socket.onopen = () => {
      this.#send<unknown>('hello', {
        token: this.#options.token,
        protocolVersion: PROTOCOL_VERSION,
        client: { name: 'plugin', version: this.#options.version }
      }).then(
        () => {
          this.#attempt = 0;
          this.#setState('ready');
        },
        (error: Error) => {
          this.#setState('closed', error.message);
          socket.close();
        }
      );
    };
    socket.onmessage = (event) => this.#receive(String(event.data));
    socket.onclose = () => {
      if (this.#socket !== socket) return;
      this.#socket = null;
      for (const [id, pending] of this.#pending) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Boite closed the connection'));
        this.#pending.delete(id);
      }
      this.#scheduleRetry();
    };
  }

  #scheduleRetry(error?: string): void {
    if (this.#stopped) return;
    this.#setState('closed', error);
    const wait = RETRY_MS[Math.min(this.#attempt, RETRY_MS.length - 1)]!;
    this.#attempt++;
    this.#retry = setTimeout(() => this.#open(), wait);
  }

  #receive(text: string): void {
    // A chunk frame starts with U+001E; Carton never asks for them.
    if (text.startsWith('\u001e')) return;
    let frame: { id?: number; method?: string; params?: unknown; result?: unknown; error?: { code: number; message: string } };
    try {
      frame = JSON.parse(text);
    } catch {
      return;
    }
    if (typeof frame.id === 'number' && this.#pending.has(frame.id)) {
      const pending = this.#pending.get(frame.id)!;
      this.#pending.delete(frame.id);
      clearTimeout(pending.timer);
      if (frame.error) pending.reject(new RpcError(frame.error.code, frame.error.message));
      else pending.resolve(frame.result);
      return;
    }
    if (typeof frame.method === 'string' && frame.id === undefined) {
      for (const listener of this.#listeners.get(frame.method) ?? []) listener(frame.params);
    }
  }
}
