import { RoomParameters } from '../../browser/roomMaker';
import { RoomState } from '../../room/bonkRoom';
import type { GameMode, GameModeId, IRoomForMode } from '../types';
import type { Player } from '../../room/bonkRoom';
import { getModeConfig } from '../../config/modeConfig';

/**
 * FFA: sem times, todos jogam. Quando um jogador entra, o bot espera um ponto;
 * após um ponto/vencedor, adiciona o jogador em tempo real (sem voltar ao lobby).
 * Round to win vem da config.
 */
export function createFfaMode(modeId: GameModeId): GameMode {
  const config = getModeConfig(modeId)!;

  return {
    id: modeId,
    name: config.name,

    getRoomParams(base): RoomParameters {
      return {
        name: base.name ?? config.name,
        password: base.password ?? '',
        maxPlayers: base.maxPlayers ?? 8,
        minLevel: base.minLevel ?? 0,
        unlisted: base.unlisted ?? false,
        mode: config.gameMode,
        rounds: config.rounds,
        maps: base.maps ?? [],
        teams: false,
        favoriteIndex: base.favoriteIndex ?? config.favoriteIndex ?? 0,
      };
    },

    getInGamePlayers(room: IRoomForMode): Player[] {
      const queue = room.getQueue();
      return Array.from(queue.values()).filter(p => p.inRoom);
    },

    canStart(room: IRoomForMode): boolean {
      const inGame = this.getInGamePlayers!(room);
      return inGame.length >= 1;
    },

    async onPlayerJoined(room: IRoomForMode): Promise<void> {
      if (room.getState() !== RoomState.IDLE) return;
      const inGame = this.getInGamePlayers!(room);
      if (inGame.length >= 1) {
        room.setState(RoomState.READY);
        room.startTransitionTimer(60000);
        await room.allReadyReset();
        await room.chat('Novo jogador na fila. Após o próximo ponto, entre na partida. Cliquem em Ready ou !r.');
      }
    },

    async transitionFromIdle(room: IRoomForMode): Promise<void> {
      const inGame = this.getInGamePlayers!(room);
      if (inGame.length >= 1) {
        await this.startMapSelection!(room);
      } else {
        room.startTransitionTimer(5000);
      }
    },

    async startMapSelection(room: IRoomForMode): Promise<void> {
      room.setState(RoomState.READY);
      room.startTransitionTimer(60000);
      await room.allReadyReset();
      await room.chat('Corrida de Cart. Cliquem em Ready ou !r para iniciar.');
    },

    async onGameEnd(room: IRoomForMode): Promise<void> {
      await room.resetToIdle();
    },

    getHelpMessage(): string {
      return '!help !ping !queue !r !reset !cancel | !brbrr !sortear !kick !ban (votação)';
    },

    async handleCommand(room: IRoomForMode, _playerId: number, cmd: string): Promise<boolean> {
      if (cmd === 'p' || cmd === 'pick') {
        await room.chat('Corrida de Cart não usa !p. Todos jogam ao mesmo tempo.');
        return true;
      }
      return false;
    },
  };
}
