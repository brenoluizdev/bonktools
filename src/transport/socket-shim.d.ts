// socket.io-client@2 não tem bundled types — este shim é obrigatório.
// Verificado: `npm view socket.io-client@2.5.0 types` retorna undefined.
declare module 'socket.io-client' {
  interface SocketOptions {
    transports?: string[];
    reconnection?: boolean;
    timeout?: number;
    forceNew?: boolean;
    path?: string;
    rejectUnauthorized?: boolean;
    ca?: Buffer | string | Array<Buffer | string>;
    extraHeaders?: Record<string, string>;
  }

  interface Socket {
    id: string;
    connected: boolean;
    disconnected: boolean;
    on(event: string, listener: (...args: unknown[]) => void): this;
    once(event: string, listener: (...args: unknown[]) => void): this;
    off(event: string, listener?: (...args: unknown[]) => void): this;
    emit(event: string | number, ...args: unknown[]): this;
    disconnect(): this;
    connect(): this;
  }

  function io(url: string, opts?: SocketOptions): Socket;
  export = io;
}
