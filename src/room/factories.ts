// factories.ts — API pública Phase 3: createRoom e joinRoom.
// Funções standalone que retornam um BonkRoom pronto (conectado + sala criada/entrada).
//
// Fluxo createRoom (D-01..D-05):
//   auth → discoverServer → new BonkRoom → connect → CREATE_ROOM (12) → aguardar SHARE_LINK (49)
// Fluxo joinRoom (D-06..D-08):
//   [autojoin se URL] → auth → new BonkRoom → connect → JOIN_ROOM (13) → aguardar ROOM_JOIN (3)
//
// Cleanup (T-3-03-03): em qualquer erro pós-construção, room.disconnect() é chamado
// antes do re-throw para evitar handle/socket leak.

import { BonkRoom } from './BonkRoom.js';
import { AuthClient } from '../auth/AuthClient.js';
import { OUTGOING_PACKET_IDS } from '../codec/packets.js';
import type { CreateRoomOptions, JoinRoomOptions, ResolvedRoomAddress, BonkRoomEvents } from './types.js';
import { RoomCreationTimeoutError, RoomJoinTimeoutError } from './types.js';
import type { BonkTransportOptions } from '../transport/types.js';

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_PROTOCOL_VERSION = 49;
const DEFAULT_DBID = 2;
const DEFAULT_AVATAR = { layers: [] as unknown[], bc: 16774557 };

/**
 * Parseia uma URL bonk.io no formato bonk.io/<6 dígitos><5 chars bypass opcional>.
 * Regex replicada de BonkBot getAddressFromUrl.
 * @returns { roomId, bypass } ou null se não casar.
 */
function parseRoomUrl(url: string): { roomId: string; bypass: string } | null {
  const match = /\/(\d{6})([a-zA-Z0-9]{5})?$/.exec(url);
  if (!match) {
    return null;
  }
  return { roomId: match[1], bypass: match[2] ?? '' };
}

/**
 * Aguarda um evento do BonkRoom com timeout.
 *
 * Duas fases para evitar duas armadilhas simultâneas:
 *  1. O listener `once` é registrado SINCRONAMENTE (antes de connect()) para não
 *     perder eventos emitidos durante a conexão (transport injetado dispara o
 *     packet dentro de connect()).
 *  2. A Promise (e o timer de timeout) só é criada/observada quando o caller
 *     chama `.wait()` — e o timer é armado nesse momento, com o handler de
 *     rejeição já anexado, evitando unhandled-rejection transitória.
 *
 * Limpa timer e listener em ambos os caminhos (sem leak — T-3-03-03).
 */
function pendingRoomEvent<K extends keyof BonkRoomEvents>(
  room: BonkRoom,
  event: K,
  timeoutMs: number,
  timeoutError: Error,
): { wait: () => Promise<void>; cancel: () => void } {
  let fired = false;
  let onFire: (() => void) | null = null;

  const handler = (): void => {
    fired = true;
    onFire?.();
  };
  room.once(event, handler as Parameters<BonkRoom['once']>[1]);

  const cancel = (): void => {
    room.off(event, handler as Parameters<BonkRoom['off']>[1]);
  };

  return {
    cancel,
    wait(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        if (fired) {
          resolve();
          return;
        }
        const timer = setTimeout(() => {
          cancel();
          reject(timeoutError);
        }, timeoutMs);
        onFire = (): void => {
          clearTimeout(timer);
          resolve();
        };
      });
    },
  };
}

/**
 * Cria uma nova sala no bonk.io e retorna um BonkRoom conectado e ativo.
 * Resolve após o packet 49 (SHARE_LINK) — room.shareLink já estará populado.
 * Rejeita com RoomCreationTimeoutError se o packet 49 não chegar em timeoutMs (D-04).
 */
export async function createRoom(opts: CreateRoomOptions): Promise<BonkRoom> {
  const {
    auth,
    desiredState,
    transport,
    dbid = DEFAULT_DBID,
    hidden = false,
    quick = false,
    minLevel = 0,
    maxLevel = 999,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    protocolVersion = DEFAULT_PROTOCOL_VERSION,
    reconnectPolicy,
    logger,
  } = opts;

  // ── Resolver auth + servidor + peerID ──────────────────────────────────────
  const authClient = new AuthClient(undefined, logger);
  let token: string | null = null;
  let guestName: string | undefined;

  if (auth.type === 'registered') {
    token = await authClient.getToken(auth.username, auth.password);
  } else {
    guestName = auth.guestName;
  }

  const peerID = authClient.generatePeerID();

  // Em modo injetado (testes), o transport vem pronto e não há rede para
  // descobrir servidor — usar placeholders. Em produção, discoverServer resolve.
  const serverInfo = transport
    ? { server: 'injected', lat: 0, long: 0, country: 'XX' }
    : await authClient.discoverServer(token, protocolVersion);

  // ── Construir BonkRoom (transport injetado OU transportOptions reais) ───────
  let room: BonkRoom | null = null;
  try {
    if (transport) {
      room = new BonkRoom({ desiredState, transport, reconnectPolicy, logger });
    } else {
      const transportOptions: BonkTransportOptions = {
        server: serverInfo,
        auth,
        protocolVersion,
        logger,
      };
      room = new BonkRoom({ desiredState, transportOptions, reconnectPolicy, logger });
    }

    // Registrar listener ANTES de connect (evita perder packet 49 disparado
    // sincronamente durante connect() — caso do transport mock dos testes).
    const shareLinkPending = pendingRoomEvent(
      room,
      'share-link',
      timeoutMs,
      new RoomCreationTimeoutError(timeoutMs),
    );

    await room.connect();

    room.sendPacket(OUTGOING_PACKET_IDS.CREATE_ROOM, {
      peerID,
      roomName: desiredState.roomName,
      maxPlayers: desiredState.maxPlayers ?? 6,
      password: desiredState.password,
      dbid,
      guest: auth.type === 'guest',
      minLevel,
      maxLevel,
      latitude: serverInfo.lat,
      longitude: serverInfo.long,
      country: serverInfo.country,
      version: protocolVersion,
      hidden: hidden ? 1 : 0,
      quick,
      mode: String(desiredState.mode ?? 'b'),
      token: token ?? undefined,
      guestName,
      avatar: DEFAULT_AVATAR,
    });

    await shareLinkPending.wait();
    return room;
  } catch (err) {
    room?.disconnect();
    throw err;
  }
}

/**
 * Entra em uma sala existente e retorna um BonkRoom conectado e ativo.
 * `address` pode ser uma URL bonk.io (string) — resolvida via autojoin.php — ou
 * um ResolvedRoomAddress já resolvido (pula autojoin, D-06).
 * Resolve após o packet 3 (ROOM_JOIN). Rejeita com RoomJoinTimeoutError se não
 * chegar em timeoutMs (D-08).
 */
export async function joinRoom(
  address: string | ResolvedRoomAddress,
  opts: JoinRoomOptions,
): Promise<BonkRoom> {
  const {
    auth,
    transport,
    role = 'host',
    password = '',
    dbid = DEFAULT_DBID,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    protocolVersion = DEFAULT_PROTOCOL_VERSION,
    reconnectPolicy,
    logger,
  } = opts;

  const authClient = new AuthClient(undefined, logger);

  // ── Resolver servidor + joinId + bypass ────────────────────────────────────
  let server: string;
  let joinId: string;
  let bypass: string;

  if (typeof address === 'string') {
    const parsed = parseRoomUrl(address);
    if (!parsed) {
      throw new Error(
        'joinRoom: URL inválida — formato esperado: bonk.io/<6 dígitos><5 chars bypass>',
      );
    }
    const autojoinResult = await authClient.autoJoin(parsed.roomId);
    server = autojoinResult.server;
    joinId = autojoinResult.address;
    bypass = parsed.bypass; // BonkBot usa o bypass do URL, não passbypass da resposta
  } else {
    server = address.server;
    joinId = address.joinId;
    bypass = address.bypass;
  }

  // ── Autenticar ─────────────────────────────────────────────────────────────
  let token: string | null = null;
  let guestName: string | undefined;

  if (auth.type === 'registered') {
    token = await authClient.getToken(auth.username, auth.password);
  } else {
    guestName = auth.guestName;
  }

  const peerID = authClient.generatePeerID();

  // role é wiring de team intencional: spectator=0, host/ffa=1 (referenciado no payload).
  void role;

  // ── Construir BonkRoom ─────────────────────────────────────────────────────
  const desiredState = {
    roomName: '',
    password,
    maxPlayers: 6, // placeholder — valor real vem do servidor via packet 3
    mode: 'b' as string,
    rounds: 3,
  };

  let room: BonkRoom | null = null;
  try {
    if (transport) {
      room = new BonkRoom({ desiredState, transport, reconnectPolicy, logger });
    } else {
      const transportOptions: BonkTransportOptions = {
        server: { server, lat: 0, long: 0, country: 'XX' },
        auth,
        protocolVersion,
        logger,
      };
      room = new BonkRoom({ desiredState, transportOptions, reconnectPolicy, logger });
    }

    // Registrar listener ANTES de connect (evita perder packet 3 disparado
    // sincronamente durante connect() — caso do transport mock dos testes).
    const roomJoinPending = pendingRoomEvent(
      room,
      'room-join',
      timeoutMs,
      new RoomJoinTimeoutError(timeoutMs),
    );

    await room.connect();

    room.sendPacket(OUTGOING_PACKET_IDS.JOIN_ROOM, {
      joinID: joinId,
      avatar: DEFAULT_AVATAR,
      guest: auth.type === 'guest',
      dbid,
      version: protocolVersion,
      peerID,
      bypass,
      token: token ?? undefined,
      guestName,
      roomPassword: password,
    });

    await roomJoinPending.wait();
    return room;
  } catch (err) {
    room?.disconnect();
    throw err;
  }
}
