// RoomState.ts — RoomState interface + PlayerData + createEmptyRoomState + 8 reducers puros.
// Fase 2: reducers são funções puras (state, packet) => newState sem mutação do argumento.
// Padrão de imutabilidade: new Map(state.players) + spread antes de modificar.
// MOD-01: roster autoritativo mantido via reduções incrementais de cada packet incoming.

import type {
  RoomJoinPacket,
  PlayerJoinPacket,
  PlayerLeavePacket,
  TeamChangePacket,
  ReadyChangePacket,
  PlayerPingsPacket,
} from '../codec/packets.js';

// ─── PlayerData ───────────────────────────────────────────────────────────────

/**
 * Dados de um jogador na sala, derivados dos packets do servidor.
 * Campos derivados (não em packets diretos): xp, balance, host.
 */
export interface PlayerData {
  id: number;
  peerID: string;
  userName: string;
  guest: boolean;
  level: number;
  /** 0=spec, 1=ffa, 2=red, 3=blue, 4=green, 5=yellow */
  team: number;
  ready: boolean;
  tabbed: boolean;
  /** Blob opaco — estrutura interna não validada (Packets.md não especifica). */
  avatar: unknown;
  /** Latência em ms, atualizada por packet 1 (PLAYER_PINGS). */
  ping: number;
  /** Estimado via levelToXP() — não existe packet de XP individual. */
  xp: number;
  /** Atualizado via packet 36 (BALANCE_SET) durante game. */
  balance: number;
  /** true se id === hostId do RoomState. */
  host: boolean;
}

// ─── RoomState ────────────────────────────────────────────────────────────────

/**
 * Estado observado da sala bonk.io, derivado dos packets incoming.
 * Alterado apenas via reducers puros — nunca mutado diretamente.
 */
export interface RoomState {
  players: Map<number, PlayerData>;
  myId: number | null;
  hostId: number | null;
  roomId: number | null;
  roomBypass: string | null;
  teamsLocked: boolean;
  inGame: boolean;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Cria um RoomState vazio (estado inicial ou pós-rebuild).
 * Usar sempre em vez de construir o objeto manualmente — garante que nenhum campo
 * vaze entre reconnections.
 */
export function createEmptyRoomState(): RoomState {
  return {
    players: new Map(),
    myId: null,
    hostId: null,
    roomId: null,
    roomBypass: null,
    teamsLocked: false,
    inGame: false,
  };
}

// ─── Tipos internos para reducers ────────────────────────────────────────────
// Alguns reducers aceitam tipos levemente diferentes dos zod schemas
// para compatibilidade com os stubs de teste (Wave 0). Esses tipos internos
// representam o subconjunto de campos que cada reducer precisa.

/** Tipo aceito por reduceUsernameChange — usa userName (campo do roster interno). */
interface UsernameChangeInput {
  type?: string;
  id: number;
  userName: string;
}

/** Tipo aceito por reduceTabbedChange — aceita qualquer string de type. */
interface TabbedChangeInput {
  type?: string;
  id: number;
  tabbed: boolean;
}

/** Tipo aceito por reducePlayerPings — pings é Record<string, number>. */
interface PlayerPingsInput {
  type?: string;
  pings: Record<string, number>;
}

// ─── Reducers puros ───────────────────────────────────────────────────────────

/**
 * Reducer para packet 3 (JOIN_ROOM) — reconstituição completa do roster.
 *
 * CRÍTICO (Pitfall 1): players[] é array com índices — null indica slot vazio.
 * O ID do jogador é o ÍNDICE no array, não um campo dentro do objeto.
 * Itera por índice numérico (for loop), não forEach, para preservar o índice.
 */
export function reduceRoomJoin(state: RoomState, packet: RoomJoinPacket): RoomState {
  const players = new Map<number, PlayerData>();

  for (let i = 0; i < packet.players.length; i++) {
    const p = packet.players[i];
    if (p !== null && p !== undefined) {
      players.set(i, {
        id: i,
        peerID: p.peerID,
        userName: p.userName,
        guest: p.guest,
        level: p.level,
        team: p.team,
        ready: p.ready ?? false,
        tabbed: p.tabbed ?? false,
        avatar: p.avatar,
        ping: 0,
        xp: 0,
        balance: 0,
        host: i === packet.hostId,
      });
    }
  }

  return {
    ...state,
    players,
    myId: packet.myId,
    hostId: packet.hostId,
    roomId: packet.roomId,
    roomBypass: packet.roomBypass,
    teamsLocked: packet.teamsLocked,
  };
}

/**
 * Reducer para packet 4 (PLAYER_JOIN) — adiciona novo jogador ao Map.
 * Usa new Map(state.players) para imutabilidade.
 */
export function reducePlayerJoin(state: RoomState, packet: PlayerJoinPacket): RoomState {
  const players = new Map(state.players);
  players.set(packet.id, {
    id: packet.id,
    peerID: packet.peerID,
    userName: packet.userName,
    guest: packet.guest,
    level: packet.level,
    team: packet.team ?? 1, // default FFA se ausente (BonkBot: args[6] || 1)
    ready: packet.ready ?? false,
    tabbed: packet.tabbed ?? false,
    avatar: packet.avatar,
    ping: 0,
    xp: 0,
    balance: 0,
    host: false,
  });
  return { ...state, players };
}

/**
 * Reducer para packet 5 (PLAYER_LEAVE) — remove jogador pelo ID.
 * Se o ID não existir no Map, retorna estado inalterado sem erro.
 */
export function reducePlayerLeave(state: RoomState, packet: PlayerLeavePacket): RoomState {
  const players = new Map(state.players);
  players.delete(packet.id);
  return { ...state, players };
}

/**
 * Reducer para packet 12 (USERNAME_CHANGE) — atualiza userName do jogador.
 * Aceita campo `userName` (nome do campo interno no roster, não o `newName` do wire).
 * Se o player não existir, retorna estado inalterado.
 */
export function reduceUsernameChange(state: RoomState, packet: UsernameChangeInput): RoomState {
  const existing = state.players.get(packet.id);
  if (!existing) {
    return state;
  }
  const players = new Map(state.players);
  players.set(packet.id, { ...existing, userName: packet.userName });
  return { ...state, players };
}

/**
 * Reducer para packet 18 (TEAM_CHANGE) — atualiza team do jogador.
 * Se o player não existir, retorna estado inalterado.
 */
export function reduceTeamChange(state: RoomState, packet: TeamChangePacket): RoomState {
  const existing = state.players.get(packet.id);
  if (!existing) {
    return state;
  }
  const players = new Map(state.players);
  players.set(packet.id, { ...existing, team: packet.team });
  return { ...state, players };
}

/**
 * Reducer para packet 8 (READY_CHANGE) — atualiza campo ready do jogador.
 * Se o player não existir, retorna estado inalterado.
 */
export function reduceReadyChange(state: RoomState, packet: ReadyChangePacket): RoomState {
  const existing = state.players.get(packet.id);
  if (!existing) {
    return state;
  }
  const players = new Map(state.players);
  players.set(packet.id, { ...existing, ready: packet.ready });
  return { ...state, players };
}

/**
 * Reducer para packet 52 (TABBED) — atualiza campo tabbed do jogador.
 * Aceita qualquer objeto com id e tabbed para compatibilidade com testes.
 * Se o player não existir, retorna estado inalterado.
 */
export function reduceTabbedChange(state: RoomState, packet: TabbedChangeInput): RoomState {
  const existing = state.players.get(packet.id);
  if (!existing) {
    return state;
  }
  const players = new Map(state.players);
  players.set(packet.id, { ...existing, tabbed: packet.tabbed });
  return { ...state, players };
}

/**
 * Reducer para packet 1 (PLAYER_PINGS) — atualiza ping de múltiplos jogadores.
 * Itera as entradas de pings; ignora silenciosamente IDs não presentes no Map.
 * Aceita PlayerPingsPacket ou objeto com pings Record<string, number>.
 */
export function reducePlayerPings(state: RoomState, packet: PlayerPingsInput): RoomState {
  const players = new Map(state.players);
  let changed = false;

  for (const [idStr, latency] of Object.entries(packet.pings)) {
    const id = Number(idStr);
    const existing = players.get(id);
    if (existing) {
      players.set(id, { ...existing, ping: latency });
      changed = true;
    }
  }

  if (!changed) return state;
  return { ...state, players };
}

export function reduceGameStart(state: RoomState): RoomState {
  return { ...state, inGame: true };
}

export function reduceGameEnd(state: RoomState): RoomState {
  return { ...state, inGame: false };
}
