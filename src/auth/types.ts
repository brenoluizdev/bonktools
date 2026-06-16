// Interfaces de autenticação e server discovery — Phase 1 (D-04: TypeScript puro, sem zod).
// Fluxo mapeado em 01-RESEARCH.md Q3 (login_legacy.php + getrooms.php).

import type { Logger } from 'pino';

/** Autenticação como convidado — não há request HTTP, apenas guestName no payload de join. */
export interface GuestAuthOptions {
  type: 'guest';
  guestName: string;
}

/** Autenticação com conta registrada — troca user/pass por token via login_legacy.php. */
export interface RegisteredAuthOptions {
  type: 'registered';
  username: string;
  password: string;
}

/** Union das estratégias de autenticação suportadas no Phase 1. */
export type AuthOptions = GuestAuthOptions | RegisteredAuthOptions;

/** Resposta de login_legacy.php. */
export interface LoginResponse {
  token: string;
}

/** Payload (form-urlencoded) enviado para getrooms.php. */
export interface GetRoomsRequest {
  version: number;
  gl: 'y';
  token: string;
}

/**
 * Informação de servidor retornada por getrooms.php.
 * O campo `createserver` da resposta vira `server` aqui.
 */
export interface ServerInfo {
  server: string;
  lat: number;
  long: number;
  country: string;
}

/**
 * Opções de conexão para o BonkTransport.
 * protocolVersion é configurável (default 49) per D-05 / ROADMAP I5 — evita o Pitfall 4
 * de hardcodar a versão do protocolo.
 */
export interface ConnectOptions {
  auth: AuthOptions;
  protocolVersion?: number;
  logger?: Logger;
}

/**
 * Resposta da autojoin.php do bonk.io.
 * Retornada quando o caller faz joinRoom com URL string (D-06 Fase 3).
 */
export interface AutoJoinResponse {
  /** join address para o JOIN_ROOM packet. */
  address: string;
  /** nome da sala (informativo). */
  roomname: string;
  /** hostname do servidor (ex: 'b2seattle1'). */
  server: string;
  /** bypass da sala. */
  passbypass: string;
  /** 'success' ou string de erro. */
  r: 'success' | string;
}
