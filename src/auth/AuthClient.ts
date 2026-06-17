// Cliente de autenticação e server discovery do bonk.io.
// D-03: HTTP usa undici Agent com CA Sectigo customizado — NUNCA NODE_TLS_REJECT_UNAUTHORIZED=0
// global nem rejectUnauthorized:false (esse bypass é exclusivo do WebSocket, D-01).
// Fluxo mapeado em 01-RESEARCH.md Pattern 2 + Q3.

import { Agent, fetch as undiciFetch } from 'undici';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as tls from 'node:tls';
import type { Logger } from 'pino';
import type { LoginResponse, ServerInfo, AutoJoinResponse } from './types.js';

// URLs exatas do bonk.io (BonkBot/src/utils/constants.js).
const LOGIN_URL = 'https://bonk2.io/scripts/login_legacy.php';
const GET_ROOMS_URL = 'https://bonk2.io/scripts/getrooms.php';
const AUTOJOIN_URL = 'https://bonk2.io/scripts/autojoin.php';

// Resposta crua de getrooms.php (createserver -> server no mapeamento).
interface GetRoomsResponse {
  createserver: string;
  lat: number;
  long: number;
  country: string;
}

/**
 * Resolve o cert PEM default relativo ao módulo atual.
 * No bundle dist achatado (`dist/index.js`), `path.dirname(fileURLToPath(import.meta.url))`
 * aponta para `packages/core/dist`, e o cert está um nível acima em `packages/core/certs`
 * → `'../certs/...'`. Quando o módulo roda do source (`src/auth/`), são dois níveis de subida
 * (`src/auth` → `packages/core`) → `'../../certs/...'`. Tenta o caminho do dist primeiro e
 * cai no do source se ausente, evitando ENOENT em ambos os contextos (CR-03).
 */
function resolveDefaultCertPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.join(here, '../certs/bonk_fullchain.pem');
  if (fs.existsSync(distPath)) {
    return distPath;
  }
  return path.join(here, '../../certs/bonk_fullchain.pem');
}

export class AuthClient {
  private readonly httpsAgent: Agent;
  private readonly logger?: Logger | undefined;

  /**
   * @param certPath caminho para a cadeia Sectigo (default: certs/bonk_fullchain.pem do pacote)
   * @param logger logger pino opcional — NUNCA loga token/credenciais, apenas eventos
   */
  constructor(certPath?: string, logger?: Logger) {
    const resolvedCertPath = certPath ?? resolveDefaultCertPath();

    // D-03: CA customizado adicionado ao trust store padrão (não substitui).
    // bonk2.io pode rotacionar CAs (ex: Sectigo → Google Trust Services);
    // adicionar ao store padrão garante que tanto o cert bundlado quanto os
    // root CAs do Node.js funcionem — sem NODE_TLS_REJECT_UNAUTHORIZED=0.
    this.httpsAgent = new Agent({
      connect: {
        ca: [fs.readFileSync(resolvedCertPath), ...tls.rootCertificates],
      },
    });
    this.logger = logger;
  }

  /**
   * Troca username/password por um token de sessão via login_legacy.php.
   * O token NUNCA é logado — apenas o evento de sucesso/falha.
   */
  async getToken(username: string, password: string): Promise<string> {
    const body = new URLSearchParams({
      username,
      password,
      remember: 'false',
    });

    const response = await undiciFetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      dispatcher: this.httpsAgent,
    });

    if (!response.ok) {
      throw new Error(`login_legacy.php: HTTP ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as Partial<LoginResponse>;
    if (!data.token) {
      this.logger?.debug({ event: 'auth_failure' });
      throw new Error('login_legacy.php: no token in response');
    }

    this.logger?.debug({ event: 'auth_success' });
    return data.token;
  }

  /**
   * Descobre o servidor para criar/entrar em sala via getrooms.php.
   * Mapeia `createserver` da resposta para `server`.
   * @param token token de sessão ou null (guest)
   * @param protocolVersion versão do protocolo (default 49 no caller — Pitfall 4)
   */
  async discoverServer(token: string | null, protocolVersion: number): Promise<ServerInfo> {
    const body = new URLSearchParams({
      version: String(protocolVersion),
      gl: 'y',
      token: token ?? '',
    });

    const response = await undiciFetch(GET_ROOMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      dispatcher: this.httpsAgent,
    });

    if (!response.ok) {
      throw new Error(`getrooms.php: HTTP ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as Partial<GetRoomsResponse>;
    if (!data.createserver) {
      throw new Error(`discoverServer: campo 'createserver' ausente na resposta de getrooms.php`);
    }

    return {
      server: data.createserver,
      lat: data.lat ?? 0,
      long: data.long ?? 0,
      country: data.country ?? 'XX',
    };
  }

  /**
   * Gera um peerID localmente, seguindo BonkBot (Q8 Open Questions: geração local,
   * não chamada HTTP). 10 chars base36 + sufixo 'v00000'.
   */
  generatePeerID(): string {
    // Formato derivado de Packets.md exemplo: 10 chars base36 + 'a00000' (total 16 chars)
    // Ex: "vuzvugdrnja00000" — o servidor valida tamanho e charset.
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    const bytes = randomBytes(10);
    let rand = '';
    for (const b of bytes) {
      rand += chars[b % 36];
    }
    return rand + 'a00000';
  }

  /**
   * Resolve o servidor de uma sala via autojoin.php.
   * Usado por joinRoom(url: string) para obter o endereço do servidor.
   * @param roomId ID numérico da sala (6 dígitos, extraído da URL bonk.io/<roomId><bypass>)
   */
  async autoJoin(roomId: string): Promise<AutoJoinResponse> {
    const body = new URLSearchParams({ joinID: roomId });

    const response = await undiciFetch(AUTOJOIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      dispatcher: this.httpsAgent,
    });

    const data = (await response.json()) as AutoJoinResponse;

    if (data.r !== 'success') {
      throw new Error(`autojoin.php: r=${String(data.r)} — sala não encontrada ou erro de servidor`);
    }

    return data;
  }
}
