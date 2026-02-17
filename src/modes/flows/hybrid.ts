import { RoomParameters } from '../../browser/roomMaker';
import { RoomState } from '../../room/bonkRoom';
import type { GameMode, GameModeId, IRoomForMode } from '../types';
import type { Player } from '../../room/bonkRoom';
import { getModeConfig } from '../../config/modeConfig';

const RED = 2;
const BLUE = 3;
const SPEC = 0;
const PLAYERS_PER_TEAM = 2;

interface HybridState {
  specQueue: number[];
  captain?: Player;
  captainTeam?: number;
  picksNeeded: number;
}

const stateByMode = new Map<string, HybridState>();

function getState(modeId: string): HybridState {
  let s = stateByMode.get(modeId);
  if (!s) {
    s = { specQueue: [], picksNeeded: 0 };
    stateByMode.set(modeId, s);
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

function getSpecQueuePlayers(room: IRoomForMode, modeId: string): Player[] {
  const queue = room.getQueue();
  const s = getState(modeId);
  return s.specQueue
    .map(id => queue.get(id))
    .filter((p): p is Player => p != null && p.inRoom && p.team === SPEC);
}

function getFirstValidInSpecQueue(room: IRoomForMode, modeId: string): number | null {
  const queue = room.getQueue();
  const s = getState(modeId);
  for (const id of s.specQueue) {
    const p = queue.get(id);
    if (p?.inRoom && p.team === SPEC) return id;
  }
  return null;
}

function formatSpecQueueList(room: IRoomForMode, modeId: string): string {
  const players = getSpecQueuePlayers(room, modeId);
  return players.map((p, i) => `${i + 1} - ${p.username}`).join(', ');
}

export function createHybridMode(modeId: GameModeId): GameMode {
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
      if (inGame.length === 2) {
        const red = inGame.filter(p => p.team === RED).length;
        const blue = inGame.filter(p => p.team === BLUE).length;
        return red === 1 && blue === 1;
      }
      if (inGame.length === 4) {
        const red = inGame.filter(p => p.team === RED).length;
        const blue = inGame.filter(p => p.team === BLUE).length;
        return red === PLAYERS_PER_TEAM && blue === PLAYERS_PER_TEAM;
      }
      return false;
    },

    async onPlayerJoined(room: IRoomForMode, player: Player): Promise<void> {
      if (room.getState() !== RoomState.IDLE) return;
      const inRoom = Array.from(room.getQueue().values()).filter(p => p.inRoom);
      const count = inRoom.length;

      if (count === 1) {
        await room.changeOtherTeam(player.id, RED);
        await room.chat('Você está no time vermelho (esquerda). Aguarde mais jogadores.');
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
      if (count === 3) {
        await room.changeOtherTeam(player.id, SPEC);
        addToSpecQueue(modeId, player.id);
        await room.chat('Fica no spec. Aguarde mais um jogador para 2v2.');
        return;
      }
      if (count === 4) {
        const s = state();
        const specIds = s.specQueue.filter(id => {
          const p = room.getQueue().get(id);
          return p?.inRoom && p.team === SPEC;
        });
        const firstSpecId = specIds[0];
        if (firstSpecId != null) {
          await room.changeOtherTeam(firstSpecId, RED);
          removeFromSpecQueue(modeId, firstSpecId);
        }
        await room.changeOtherTeam(player.id, BLUE);
        room.setState(RoomState.READY);
        room.startTransitionTimer(60000);
        await room.allReadyReset();
        await room.chat('2 no vermelho (esquerda), 2 no azul (direita). Cliquem em Ready ou !r para iniciar 2v2.');
      }
    },

    async transitionFromIdle(room: IRoomForMode): Promise<void> {
      const inRoom = Array.from(room.getQueue().values()).filter(p => p.inRoom);
      const redCount = inRoom.filter(p => p.team === RED).length;
      const blueCount = inRoom.filter(p => p.team === BLUE).length;

      if (inRoom.length === 2 && redCount === 1 && blueCount === 1) {
        await this.startMapSelection!(room);
      } else if (inRoom.length >= 4 && redCount === PLAYERS_PER_TEAM && blueCount === PLAYERS_PER_TEAM) {
        await this.startMapSelection!(room);
      } else {
        room.startTransitionTimer(5000);
      }
    },

    async startMapSelection(room: IRoomForMode): Promise<void> {
      const inGame = this.getInGamePlayers!(room);
      room.setState(RoomState.READY);
      room.startTransitionTimer(60000);
      await room.allReadyReset();
      if (inGame.length === 2) {
        await room.chat('1v1 pronto. Cliquem em Ready ou !r para iniciar.');
      } else {
        await room.chat('2v2 pronto. Cliquem em Ready ou !r para iniciar.');
      }
    },

    async onGameEnd(room: IRoomForMode, winnerTeam?: number): Promise<void> {
      const queue = room.getQueue();
      const inRoom = Array.from(queue.values()).filter(p => p.inRoom);
      const redPlayers = inRoom.filter(p => p.team === RED);
      const bluePlayers = inRoom.filter(p => p.team === BLUE);
      const specPlayers = inRoom.filter(p => p.team === SPEC);

      let losingTeam: number;
      if (winnerTeam === RED) losingTeam = BLUE;
      else if (winnerTeam === BLUE) losingTeam = RED;
      else losingTeam = redPlayers.length === 0 ? BLUE : RED;

      const losers = losingTeam === RED ? redPlayers : bluePlayers;
      const s = state();

      if (inRoom.length <= 4) {
        if (specPlayers.length === 2) {
          for (const p of losers) {
            await room.changeOtherTeam(p.id, SPEC);
            addToSpecQueue(modeId, p.id);
          }
          const [s0, s1] = specPlayers;
          removeFromSpecQueue(modeId, s0.id);
          removeFromSpecQueue(modeId, s1.id);
          await room.changeOtherTeam(s0.id, losingTeam);
          await room.changeOtherTeam(s1.id, losingTeam);
          await room.allReadyReset();
          room.setState(RoomState.READY);
          room.startTransitionTimer(60000);
          await room.chat('Substituição automática: os 2 do spec entram. Cliquem em Ready ou !r.');
        } else if (specPlayers.length === 1 && inRoom.length === 4) {
          for (const p of losers) {
            await room.changeOtherTeam(p.id, SPEC);
            addToSpecQueue(modeId, p.id);
          }
          s.captain = specPlayers[0];
          s.captainTeam = losingTeam === RED ? BLUE : RED;
          removeFromSpecQueue(modeId, specPlayers[0].id);
          await room.changeOtherTeam(specPlayers[0].id, s.captainTeam);
          s.picksNeeded = 1;
          room.setState(RoomState.PICK);
          room.startTransitionTimer(60000);
          const list = formatSpecQueueList(room, modeId);
          await room.chat(`${specPlayers[0].username}, você é o capitão do novo time. Digite o número da fila: ${list || '(vazio)'} (ex: 1 ou 2).`);
        } else if (specPlayers.length === 1 && inRoom.length === 3) {
          for (const p of losers) {
            await room.changeOtherTeam(p.id, SPEC);
            addToSpecQueue(modeId, p.id);
          }
          const firstId = getFirstValidInSpecQueue(room, modeId);
          if (firstId != null) {
            removeFromSpecQueue(modeId, firstId);
            await room.changeOtherTeam(firstId, losingTeam === RED ? BLUE : RED);
          }
          await room.allReadyReset();
          room.setState(RoomState.READY);
          room.startTransitionTimer(60000);
          await room.chat('Primeiro da fila entrou. Cliquem em Ready ou !r para 1v1.');
        } else {
          await room.resetToIdle();
          s.specQueue = [];
          s.captain = undefined;
          s.captainTeam = undefined;
        }
        return;
      }

      if (inRoom.length >= 5) {
        const winners = losingTeam === RED ? bluePlayers : redPlayers;
        for (const p of losers) {
          await room.changeOtherTeam(p.id, SPEC);
          addToSpecQueue(modeId, p.id);
        }
        for (const p of winners) {
          await room.changeOtherTeam(p.id, RED);
        }
        const firstInQueue = getFirstValidInSpecQueue(room, modeId);
        if (firstInQueue == null) {
          s.specQueue = [];
          s.captain = undefined;
          await room.resetToIdle();
          return;
        }
        const captainPlayer = queue.get(firstInQueue);
        if (!captainPlayer?.inRoom) {
          s.specQueue = s.specQueue.filter(id => id !== firstInQueue);
          s.captain = undefined;
          await room.resetToIdle();
          return;
        }
        removeFromSpecQueue(modeId, firstInQueue);
        await room.changeOtherTeam(firstInQueue, BLUE);
        s.captain = captainPlayer;
        s.captainTeam = BLUE;
        s.picksNeeded = PLAYERS_PER_TEAM - 1;
        room.setState(RoomState.PICK);
        room.startTransitionTimer(60000);
        const list = formatSpecQueueList(room, modeId);
        await room.chat(`${captainPlayer.username}, você é o capitão (time azul). Time vermelho manteve a vitória. Escolha da fila: ${list || '(vazio)'} — digite o número (1, 2, etc).`);
      }
    },

    getHelpMessage(): string {
      return '!help !ping !queue !r !reset !cancel | pick: digite o número (1, 2...) | !p pausar (votação) | !brbrr !sortear !kick !ban (votação)';
    },

    async handleCommand(
      room: IRoomForMode,
      playerId: number,
      cmd: string,
      args: string[]
    ): Promise<boolean> {
      const s = state();
      const isNumberOnly = cmd === '' && args.length === 1 && room.getState() === RoomState.PICK && s.captain?.id === playerId;
      if (!isNumberOnly) return false;
      if (room.getState() !== RoomState.PICK) return false;

      if (!s.captain || s.captain.id !== playerId) {
        await room.chat(`É a vez do capitão ${s.captain?.username ?? '?'} digitar o número da fila (ex: 1 ou 2).`);
        return true;
      }

      const raw = (args[0] ?? '').trim();
      const num = parseInt(raw, 10);
      if (Number.isNaN(num) || num < 1) {
        const list = formatSpecQueueList(room, modeId);
        await room.chat(`Digite só o número da fila (1, 2, 3...). Fila: ${list || '(vazia)'}`);
        return true;
      }

      const specList = getSpecQueuePlayers(room, modeId);
      const index = num - 1;
      if (index >= specList.length) {
        const list = formatSpecQueueList(room, modeId);
        await room.chat(`Número inválido. Fila: ${list || '(vazia)'}`);
        return true;
      }

      const picked = specList[index];
      const captainTeam = s.captainTeam ?? BLUE;
      await room.changeOtherTeam(picked.id, captainTeam);
      removeFromSpecQueue(modeId, picked.id);
      s.picksNeeded--;

      if (s.picksNeeded <= 0) {
        s.captain = undefined;
        s.captainTeam = undefined;
        await room.allReadyReset();
        room.setState(RoomState.READY);
        room.startTransitionTimer(60000);
        await room.chat('Times formados. Cliquem em Ready ou !r para iniciar.');
        return true;
      }

      const list = formatSpecQueueList(room, modeId);
      await room.chat(`${picked.username} entrou no seu time. Faltam ${s.picksNeeded}. Escolha outro: ${list || '(vazio)'} — digite o número.`);
      return true;
    },
  };
}
