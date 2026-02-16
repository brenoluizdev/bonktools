import { RoomParameters } from '../../browser/roomMaker';
import { RoomState } from '../../room/bonkRoom';
import type { GameMode, GameModeId, IRoomForMode } from '../types';
import type { Player } from '../../room/bonkRoom';
import { getModeConfig } from '../../config/modeConfig';
import { fuzzyMatch } from '../mbappa2x2/utils';

const RED = 2;   // time vermelho, lado esquerdo
const BLUE = 3;  // time azul, lado direito
const SPEC = 0;

interface PickState {
  picker?: Player;
  pickable?: Player[];
  specQueue: number[];
}

const pickStateByMode = new Map<string, PickState>();

function getState(modeId: string): PickState {
  let s = pickStateByMode.get(modeId);
  if (!s) {
    s = { specQueue: [] };
    pickStateByMode.set(modeId, s);
  }
  return s;
}

function addToSpecQueue(modeId: string, playerId: number): void {
  const s = getState(modeId);
  if (!s.specQueue.includes(playerId)) s.specQueue.push(playerId);
}

function removeFromSpecQueue(modeId: string, playerId: number): void {
  const s = getState(modeId);
  s.specQueue = s.specQueue.filter(id => id !== playerId);
}

export function create1v1PickMode(modeId: GameModeId): GameMode {
  const config = getModeConfig(modeId)!;
  const state = () => getState(modeId);

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
        teams: config.teams,
        favoriteIndex: base.favoriteIndex ?? config.favoriteIndex ?? 0,
      };
    },

    getInGamePlayers(room: IRoomForMode): Player[] {
      const queue = room.getQueue();
      return Array.from(queue.values()).filter(
        p => p.inRoom && (p.team === RED || p.team === BLUE)
      );
    },

    canStart(room: IRoomForMode): boolean {
      const inGame = this.getInGamePlayers!(room);
      if (inGame.length !== 2) return false;
      const red = inGame.filter(p => p.team === RED).length;
      const blue = inGame.filter(p => p.team === BLUE).length;
      return red === 1 && blue === 1;
    },

    async onPlayerJoined(room: IRoomForMode, player: Player): Promise<void> {
      if (room.getState() !== RoomState.IDLE) return;
      const inRoom = Array.from(room.getQueue().values()).filter(p => p.inRoom);
      const count = inRoom.length;

      if (count === 1) {
        await room.changeOtherTeam(player.id, RED);
        await room.chat('Você está no time vermelho (lado esquerdo). Aguarde mais um jogador para iniciar.');
        return;
      }
      if (count === 2) {
        await room.changeOtherTeam(player.id, BLUE);
        room.setState(RoomState.READY);
        room.startTransitionTimer(60000);
        await room.allReadyReset();
        await room.chat('Time azul (direita) entrou. Reiniciando partida para os 2 jogarem. Cliquem em Ready ou !r.');
        return;
      }
      await room.changeOtherTeam(player.id, SPEC);
      addToSpecQueue(modeId, player.id);
      await room.chat('Fica no spec. Você está na fila. Aguarde sua vez.');
    },

    async transitionFromIdle(room: IRoomForMode): Promise<void> {
      const inGame = this.getInGamePlayers!(room);
      const redCount = inGame.filter(p => p.team === RED).length;
      const blueCount = inGame.filter(p => p.team === BLUE).length;
      if (inGame.length >= 2 && redCount === 1 && blueCount === 1) {
        await this.startMapSelection!(room);
      } else {
        room.startTransitionTimer(5000);
      }
    },

    async startMapSelection(room: IRoomForMode): Promise<void> {
      room.setState(RoomState.READY);
      room.startTransitionTimer(60000);
      await room.allReadyReset();
      await room.chat('1v1 pronto. Cliquem em Ready ou !r para iniciar.');
    },

    async onGameEnd(room: IRoomForMode, winnerTeam?: number): Promise<void> {
      const queue = room.getQueue();
      const inRoom = Array.from(queue.values()).filter(p => p.inRoom);
      const inGame = inRoom.filter(p => p.team === RED || p.team === BLUE);
      const specPlayers = inRoom.filter(p => p.team === SPEC);
      const s = state();

      if (inGame.length !== 2) {
        await room.resetToIdle();
        s.specQueue = [];
        s.picker = undefined;
        s.pickable = undefined;
        return;
      }

      const redPlayers = inRoom.filter(p => p.team === RED);
      const bluePlayers = inRoom.filter(p => p.team === BLUE);
      let losingTeam: number;
      if (winnerTeam === RED) losingTeam = BLUE;
      else if (winnerTeam === BLUE) losingTeam = RED;
      else losingTeam = redPlayers.length === 0 ? BLUE : RED;
      const losers = losingTeam === RED ? redPlayers : bluePlayers;

      for (const p of losers) {
        await room.changeOtherTeam(p.id, SPEC);
        addToSpecQueue(modeId, p.id);
      }

      if (specPlayers.length >= 1) {
        s.picker = specPlayers[0];
        s.pickable = [...inGame];
        room.setState(RoomState.PICK);
        room.startTransitionTimer(60000);
        await room.chat(`${specPlayers[0].username}, digite !p <abreviação> para escolher quem enfrentar. Ex: !p nome`);
        return;
      }

      const firstId = s.specQueue[0];
      if (firstId != null) {
        removeFromSpecQueue(modeId, firstId);
        await room.changeOtherTeam(firstId, losingTeam);
      }
      await room.allReadyReset();
      room.setState(RoomState.READY);
      room.startTransitionTimer(60000);
      await room.chat('Primeiro da fila entrou. Cliquem em Ready ou !r para iniciar.');
    },

    getHelpMessage(): string {
      return '!help !ping !queue !r !p <jogador> !reset !cancel | !brbrr !sortear !kick !ban (votação)';
    },

    async handleCommand(
      room: IRoomForMode,
      playerId: number,
      cmd: string,
      args: string[]
    ): Promise<boolean> {
      if (cmd !== 'p' && cmd !== 'pick') return false;
      if (room.getState() !== RoomState.PICK) return false;

      const s = state();
      if (!s.picker || s.picker.id !== playerId) {
        await room.chat(`É a vez de ${s.picker?.username ?? 'quem está no spec'} digitar !p <jogador>.`);
        return true;
      }
      if (!s.pickable?.length) {
        await room.chat('Ninguém para escolher.');
        return true;
      }

      const query = args.join(' ').trim();
      const names = s.pickable.map(p => p.username);
      const matches = fuzzyMatch(query, names);
      if (matches.length !== 1) {
        await room.chat('Digite !p <abreviação> de um jogador. Apenas uma correspondência.');
        return true;
      }
      const pickedName = matches[0];
      const picked = s.pickable.find(p => p.username === pickedName);
      if (!picked) return true;

      const pickerTeam = picked.team === RED ? BLUE : RED;
      await room.changeOtherTeam(s.picker.id, pickerTeam);

      const inRoomPlayers = Array.from(room.getQueue().values()).filter(p => p.inRoom && (p.team === RED || p.team === BLUE));
      for (const p of inRoomPlayers) {
        if (p.id !== s.picker!.id && p.id !== picked.id) {
          await room.changeOtherTeam(p.id, SPEC);
          addToSpecQueue(modeId, p.id);
        }
      }

      s.picker = undefined;
      s.pickable = undefined;

      await room.allReadyReset();
      room.setState(RoomState.READY);
      room.startTransitionTimer(60000);
      await room.chat('Cliquem em Ready ou !r para iniciar.');
      return true;
    },
  };
}
