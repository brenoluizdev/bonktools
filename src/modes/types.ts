import { RoomParameters } from '../browser/roomMaker';
import { Player, RoomState } from '../room/bonkRoom';

export type GameModeId =
  | 'mbappa1x1'
  | 'mbappa2x2'
  | 'classic1x1'
  | 'grapple1x1'
  | 'deatharrow1x1'
  | 'blclassic'
  | 'volei1x1'
  | 'barkball'
  | 'blbasketball'
  | 'blvolleyball'
  | 'corridacart';

export interface IRoomForMode {
  getState(): RoomState;
  setState(s: RoomState): void;
  getQueue(): Map<number, Player>;
  chat(message: string): Promise<void>;
  getGameFrame(): Promise<any>;
  changeOtherTeam(playerId: number, team: number): Promise<boolean>;
  allReadyReset(): Promise<void>;
  loadMap(mapJson: string): Promise<void>;
  startGame(): Promise<void>;
  getPicker(): Player | undefined;
  setPicker(p: Player | undefined): void;
  getPicked(): Player | undefined;
  setPicked(p: Player | undefined): void;
  startTransitionTimer(ms: number): void;
  clearTransitionTimer(): void;
  getVoteReset(): number[];
  setVoteReset(ids: number[]): void;
  getVoteCancel(): number[];
  setVoteCancel(ids: number[]): void;
  resetToIdle(): Promise<void>;
}

export interface GameMode {
  id: GameModeId;
  name: string;

  getRoomParams(base: Partial<RoomParameters>): RoomParameters;

  getInGamePlayers(room: IRoomForMode): Player[];

  canStart(room: IRoomForMode): boolean;

  transitionFromIdle(room: IRoomForMode): Promise<void>;

  startMapSelection(room: IRoomForMode): Promise<void>;

  onGameEnd(room: IRoomForMode, winnerTeam?: number): Promise<void>;

  onPlayerJoined?(room: IRoomForMode, player: Player): Promise<void>;

  getHelpMessage(): string;

  handleCommand(room: IRoomForMode, playerId: number, cmd: string, args: string[]): Promise<boolean>;
}

export const GENERAL_COMMANDS = ['help', 'h', '?', 'ping', 'q', 'queue', 'd', 'discord', 'r', 'ready', 're', 'reset', 'c', 'cancel'] as const;
