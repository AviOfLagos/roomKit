// Minimal ambient declarations so `tsc` succeeds before `pnpm install`
// runs at the repo root and pulls in @types/node + @types/ws.
//
// Everything below uses interface merging so it stays compatible after
// the real type packages land — adding members never clashes, only
// re-declaring concrete classes does.

declare module 'node:events' {
  // Interface form merges with @types/node's class EventEmitter when
  // present. Before install, this is the only declaration, and a class
  // is structurally compatible with an interface for `new`-less use.
  interface EventEmitter {
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
    removeAllListeners(event?: string): this;
    setMaxListeners(n: number): this;
  }
  const EventEmitter: {
    new (): EventEmitter;
    prototype: EventEmitter;
  };
  export { EventEmitter };
}

declare module 'ws' {
  import { EventEmitter } from 'node:events';
  interface WebSocketInstance extends EventEmitter {
    readonly readyState: number;
    send(data: any, cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string): void;
  }
  const WebSocket: {
    new (url: string, options?: any): WebSocketInstance;
    readonly OPEN: number;
    readonly CLOSED: number;
    readonly CONNECTING: number;
    readonly CLOSING: number;
  };
  export default WebSocket;
}

interface Buffer extends Uint8Array {
  toString(encoding?: string, start?: number, end?: number): string;
}
declare const Buffer: {
  alloc(size: number, fill?: number): Buffer;
  from(data: ArrayBuffer | ArrayLike<number> | string, encoding?: string): Buffer;
  isBuffer(obj: unknown): obj is Buffer;
  concat(list: ReadonlyArray<Uint8Array>, totalLength?: number): Buffer;
};

declare function queueMicrotask(callback: () => void): void;
declare function setImmediate(callback: () => void): unknown;
