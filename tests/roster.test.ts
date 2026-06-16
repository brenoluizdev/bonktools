import { describe, it, expect } from 'vitest';
// Wave 0 scaffold — imports FALHAM até o plano 02-02 criar RoomState.ts.
// Esperado e correto (Nyquist: testes RED antes da implementação).
import {
  createEmptyRoomState,
  reduceRoomJoin,
  reducePlayerJoin,
  reducePlayerLeave,
  reduceUsernameChange,
  reduceTeamChange,
  reduceReadyChange,
  reduceTabbedChange,
  reducePlayerPings,
} from '../src/room/RoomState.js';
import type { RoomJoinPacket, PlayerJoinPacket, PlayerLeavePacket } from '../src/codec/packets.js';

// Fixture derivada de DemystifyBonk/Packets.md.
// players[0] = null indica slot vazio (Pitfall 1: nulls no array de players).
// players[1] = PlayerData com os campos canônicos do protocolo bonk.io.
const ROOM_JOIN_FIXTURE: RoomJoinPacket = {
  type: 'ROOM_JOIN',
  myId: 0,
  hostId: 0,
  players: [
    null,
    {
      peerID: 'abc123v00000',
      userName: 'TestBot',
      guest: false,
      team: 1,
      level: 10,
      ready: false,
      tabbed: false,
      avatar: { layers: [], bc: 0 },
    },
  ],
  timestamp: 1718000000000,
  teamsLocked: false,
  roomId: 12345,
  roomBypass: 'agsey',
};

const PLAYER_JOIN_FIXTURE: PlayerJoinPacket = {
  type: 'PLAYER_JOIN',
  id: 2,
  peerID: 'def456v00000',
  userName: 'NewPlayer',
  guest: true,
  team: 0,
  level: 5,
  ready: false,
  tabbed: false,
  avatar: { layers: [], bc: 0 },
};

const PLAYER_LEAVE_FIXTURE: PlayerLeavePacket = {
  type: 'PLAYER_LEAVE',
  id: 2,
};

describe('reduceRoomJoin — snapshot autoritativo (packet 3)', () => {
  it('popula o Map a partir do array players, ignorando nulls (slots vazios)', () => {
    const state = createEmptyRoomState();
    const next = reduceRoomJoin(state, ROOM_JOIN_FIXTURE);
    // null em índice 0 → não adiciona ao Map
    expect(next.players.has(0)).toBe(false);
    // índice 1 → adiciona com id === 1
    expect(next.players.has(1)).toBe(true);
    expect(next.players.get(1)?.userName).toBe('TestBot');
  });

  it('define myId, hostId, roomId e roomBypass a partir do packet', () => {
    const state = createEmptyRoomState();
    const next = reduceRoomJoin(state, ROOM_JOIN_FIXTURE);
    expect(next.myId).toBe(0);
    expect(next.hostId).toBe(0);
    expect(next.roomId).toBe(12345);
    expect(next.roomBypass).toBe('agsey');
  });

  it('não muta o estado original (imutabilidade)', () => {
    const state = createEmptyRoomState();
    reduceRoomJoin(state, ROOM_JOIN_FIXTURE);
    expect(state.players.size).toBe(0);
    expect(state.myId).toBeNull();
  });
});

describe('reducePlayerJoin — adiciona player ao Map (packet 4)', () => {
  it('adiciona o novo player ao Map existente', () => {
    const state = createEmptyRoomState();
    const next = reducePlayerJoin(state, PLAYER_JOIN_FIXTURE);
    expect(next.players.has(2)).toBe(true);
    expect(next.players.get(2)?.userName).toBe('NewPlayer');
  });

  it('não muta o Map original', () => {
    const state = createEmptyRoomState();
    reducePlayerJoin(state, PLAYER_JOIN_FIXTURE);
    expect(state.players.size).toBe(0);
  });
});

describe('reducePlayerLeave — remove player do Map (packet 5)', () => {
  it('remove o player do Map existente', () => {
    const state = createEmptyRoomState();
    const withPlayer = reducePlayerJoin(state, PLAYER_JOIN_FIXTURE);
    expect(withPlayer.players.has(2)).toBe(true);
    const next = reducePlayerLeave(withPlayer, PLAYER_LEAVE_FIXTURE);
    expect(next.players.has(2)).toBe(false);
  });

  it('não falha se o id não existe no Map', () => {
    const state = createEmptyRoomState();
    const next = reducePlayerLeave(state, { type: 'PLAYER_LEAVE', id: 99 });
    expect(next.players.size).toBe(0);
  });
});

describe('reduceUsernameChange — atualiza userName do player (packet 1)', () => {
  it('atualiza o userName do player no Map', () => {
    const state = createEmptyRoomState();
    const withPlayer = reducePlayerJoin(state, PLAYER_JOIN_FIXTURE);
    const next = reduceUsernameChange(withPlayer, {
      type: 'USERNAME_CHANGE',
      id: 2,
      userName: 'RenamedPlayer',
    });
    expect(next.players.get(2)?.userName).toBe('RenamedPlayer');
  });
});

describe('reduceTeamChange — atualiza team do player (packet 8)', () => {
  it('atualiza o campo team do player', () => {
    const state = createEmptyRoomState();
    const withPlayer = reducePlayerJoin(state, PLAYER_JOIN_FIXTURE);
    const next = reduceTeamChange(withPlayer, {
      type: 'TEAM_CHANGE',
      id: 2,
      team: 3,
    });
    expect(next.players.get(2)?.team).toBe(3);
  });
});

describe('reduceReadyChange — atualiza ready do player (packet 52)', () => {
  it('atualiza o campo ready do player', () => {
    const state = createEmptyRoomState();
    const withPlayer = reducePlayerJoin(state, PLAYER_JOIN_FIXTURE);
    const next = reduceReadyChange(withPlayer, {
      type: 'READY_CHANGE',
      id: 2,
      ready: true,
    });
    expect(next.players.get(2)?.ready).toBe(true);
  });
});

describe('reduceTabbedChange — atualiza tabbed do player (packet 12)', () => {
  it('atualiza o campo tabbed do player', () => {
    const state = createEmptyRoomState();
    const withPlayer = reducePlayerJoin(state, PLAYER_JOIN_FIXTURE);
    const next = reduceTabbedChange(withPlayer, {
      type: 'TABBED_CHANGE',
      id: 2,
      tabbed: true,
    });
    expect(next.players.get(2)?.tabbed).toBe(true);
  });
});

describe('reducePlayerPings — atualiza ping de cada player (packet 18)', () => {
  it('atualiza os pings de múltiplos players simultaneamente', () => {
    const state = createEmptyRoomState();
    // Adicionar dois players
    const w1 = reducePlayerJoin(state, PLAYER_JOIN_FIXTURE);
    const w2 = reducePlayerJoin(w1, {
      type: 'PLAYER_JOIN',
      id: 3,
      peerID: 'ghi789v00000',
      userName: 'AnotherPlayer',
      guest: false,
      team: 1,
      level: 20,
      ready: true,
      tabbed: false,
      avatar: { layers: [], bc: 0 },
    });
    const next = reducePlayerPings(w2, {
      type: 'PLAYER_PINGS',
      pings: { 2: 45, 3: 120 },
    });
    expect(next.players.get(2)?.ping).toBe(45);
    expect(next.players.get(3)?.ping).toBe(120);
  });
});
