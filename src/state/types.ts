/**
 * Tipos para o estado da sala
 */

export enum RoomState {
  IDLE = "idle",
  PICK = "pick",
  READY = "ready",
  GAME_STARTING = "gameStarting",
  IN_GAME = "inGame",
}

export interface Player {
  id: number;
  username: string;
  team: number;
  ready: boolean;
  joinedAt: number;
}

export interface MatchPlayers {
  picker?: Player;
  picked?: Player;
}

export interface VoteSystem {
  reset: Set<number>;
  cancel: Set<number>;
}
