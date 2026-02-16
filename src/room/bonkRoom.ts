import { Browser, Page } from 'puppeteer';
import { RoomParameters } from '../browser/roomMaker';
import type { GameMode, IRoomForMode } from '../modes/types';
import { fuzzyMatch } from '../modes/mbappa2x2/utils';

const DEBUG_LOG = process.env.BONK_DEBUG === '1' || process.env.BONK_DEBUG === 'true';

function logDebug(tag: string, data: Record<string, unknown>): void {
  if (!DEBUG_LOG) return;
  const line = Object.entries(data)
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' ');
  console.log(`[BonkRoom:LOG] ${tag} | ${line}`);
}

export enum RoomState {
  IDLE = 'idle',
  PICK = 'pick',
  MAP_SELECTION = 'mapSelection',
  READY = 'ready',
  GAME_STARTING = 'gameStarting',
  IN_GAME = 'inGame',
}

export interface Player {
  id: number;
  username: string;
  team: number;
  ready: boolean;
  readyCmd: boolean; // Ready via comando !r
  inRoom: boolean;
  lastSeen: number;
}

export class BonkRoom {
  private browser: Browser;
  private page: Page;
  private params: RoomParameters;
  private state: RoomState = RoomState.IDLE;
  private updateInterval?: NodeJS.Timeout;
  private transitionTimer?: NodeJS.Timeout;
  private queue: Map<number, Player> = new Map();
  private picker?: Player;
  private picked?: Player;
  private updateTickCount = 0;
  private voteReset: number[] = [];
  private voteCancel: number[] = [];
  private mode: GameMode;
  private newPlayersThisTick: Player[] = [];
  private voteKick: { targetId: number; votes: Set<number> } | null = null;
  private voteBan: { targetId: number; votes: Set<number> } | null = null;
  private voteSortear: Set<number> | null = null;
  private voteCooldownUntil = 0;
  private static readonly VOTE_COOLDOWN_MS = 30000;

  constructor(browser: Browser, page: Page, params: RoomParameters, mode: GameMode) {
    this.browser = browser;
    this.page = page;
    this.params = params;
    this.mode = mode;
  }

  getRoomForMode(): IRoomForMode {
    return {
      getState: () => this.state,
      setState: (s) => { this.state = s; },
      getQueue: () => this.queue,
      chat: (msg) => this.chat(msg),
      getGameFrame: () => this.getGameFrame(),
      changeOtherTeam: (id, team) => this.changeOtherTeam(id, team),
      allReadyReset: () => this.allReadyReset(),
      loadMap: (mapJson) => this.loadMap(mapJson),
      startGame: () => this.startGame(),
      getPicker: () => this.picker,
      setPicker: (p) => { this.picker = p; },
      getPicked: () => this.picked,
      setPicked: (p) => { this.picked = p; },
      startTransitionTimer: (ms) => this.startTransitionTimer(ms),
      clearTransitionTimer: () => this.clearTransitionTimer(),
      getVoteReset: () => this.voteReset,
      setVoteReset: (ids) => { this.voteReset = ids; },
      getVoteCancel: () => this.voteCancel,
      setVoteCancel: (ids) => { this.voteCancel = ids; },
      resetToIdle: () => this.reset(),
    };
  }

  async run(): Promise<void> {
    console.log('[BonkRoom] 🎮 Iniciando gerenciamento da sala...');
    console.log('[BonkRoom] Estado inicial: IDLE');
    if (DEBUG_LOG) console.log('[BonkRoom:LOG] Log detalhado ativado (BONK_DEBUG).');

    this.updateInterval = setInterval(() => {
      this.update().catch(err => {
        console.error('[BonkRoom] ❌ Erro no update:', err);
      });
    }, 250);
    this.startTransitionTimer(5000);
    console.log('[BonkRoom] ✅ Loop iniciado');
    console.log('[BonkRoom] Aguardando jogadores entrarem...');

    if (DEBUG_LOG) {
      setTimeout(async () => {
        try {
          const frame = await this.getGameFrame();
          if (!frame) return;
          const diag = await frame.evaluate(() => {
            const buf = (window as any).messageBuffer;
            const onRecv = (window as any).sgrAPI?.onReceive;
            return {
              hasMessageBuffer: Array.isArray(buf),
              onReceiveType: typeof onRecv,
              hasSgrAPI: typeof (window as any).sgrAPI !== 'undefined',
            };
          });
          console.log('[BonkRoom] 📡 Diagnóstico chat:', diag);
        } catch (e) {
          console.log('[BonkRoom] 📡 Diagnóstico chat (erro):', (e as Error).message);
        }
      }, 1500);
    }
  }

  private async update(): Promise<void> {
    this.updateTickCount += 1;
    const tick = this.updateTickCount;
    try {
      const frame = await this.getGameFrame();
      if (!frame) {
        if (DEBUG_LOG && tick % 20 === 1) logDebug('update', { event: 'frame_null', state: this.state });
        return;
      }

      const players = await frame.evaluate(() => {
        const sgr = (window as any).sgrAPI;
        if (typeof sgr === 'undefined') return { error: 'no_sgrAPI', players: [] };
        if (sgr.players == null) return { error: 'sgrAPI.players_null', players: [] };
        try {
          return { error: null, players: sgr.getPlayers() };
        } catch (e) {
          return { error: String(e), players: [] };
        }
      });

      const playerList = Array.isArray(players) ? players : (players as any).players ?? [];
      const playerError = Array.isArray(players) ? null : (players as any).error ?? null;
      if (playerError && DEBUG_LOG && tick % 20 === 1) {
        logDebug('getPlayers', { error: playerError, state: this.state });
      }

      const inGameBefore = this.getInGamePlayers();
      const prevReady = new Map(inGameBefore.map(p => [p.id, p.ready]));
      this.newPlayersThisTick = [];
      this.updateQueue(playerList);
      if (this.mode.onPlayerJoined && this.newPlayersThisTick.length > 0) {
        for (const player of this.newPlayersThisTick) {
          await this.mode.onPlayerJoined(this.getRoomForMode(), player);
        }
      }
      if (this.state === RoomState.READY || this.state === RoomState.MAP_SELECTION) {
        const inGameAfter = this.getInGamePlayers();
        const justBecameReady = inGameAfter.some(p => p.ready && !prevReady.get(p.id));
        if (justBecameReady) await this.checkReady(true);
      }

      const messages = await frame.evaluate(() => {
        // @ts-ignore
        const msgs = window.messageBuffer || [];
        // @ts-ignore
        window.messageBuffer = [];
        return msgs;
      });

      for (const msg of messages) {
        await this.onMessage(msg);
      }

      await this.detectStateChanges(frame);

      if (DEBUG_LOG && tick % 20 === 0) {
        let frameUrl = '(cached)';
        try {
          frameUrl = frame.url();
        } catch {
          frameUrl = '(detached?)';
        }
        logDebug('status', {
          state: this.state,
          frameUrl: frameUrl.slice(0, 60),
          playersFromSgr: playerList.length,
          playerIds: playerList.map((p: any) => p.id ?? p.userName ?? p.username),
          queueSize: this.queue.size,
          messagesCount: Array.isArray(messages) ? messages.length : 0,
        });
      }
    } catch (error) {
      if (error instanceof Error && !error.message.includes('Execution context')) {
        console.error('[BonkRoom] Erro no update:', error);
        if (DEBUG_LOG) logDebug('update_error', { message: error.message, state: this.state });
      }
    }
  }

  private updateQueue(players: any[]): void {
    const botUsername = process.env.BOT_USERNAME || 'FUTHERO BOT';
    const now = Date.now();
    const name = (p: any) => p.userName ?? p.username ?? String(p.id);

    for (const p of players) {
      if (name(p) === botUsername) continue;

      const existing = this.queue.get(p.id);
      if (existing) {
        existing.team = p.team;
        existing.ready = p.ready;
        existing.inRoom = true;
        existing.lastSeen = now;
      } else {
        const newPlayer: Player = {
          id: p.id,
          username: name(p),
          team: p.team,
          ready: p.ready,
          readyCmd: false,
          inRoom: true,
          lastSeen: now,
        };
        this.queue.set(p.id, newPlayer);
        this.newPlayersThisTick.push(newPlayer);
        console.log(`[BonkRoom] ➕ ${name(p)} entrou na sala (ID: ${p.id})`);
      }
    }

    const currentIds = new Set(players.map(p => p.id));
    for (const [id, player] of this.queue.entries()) {
      if (!currentIds.has(id) && player.inRoom) {
        if (now - player.lastSeen > 60000) {
          player.inRoom = false;
          console.log(`[BonkRoom] ➖ ${player.username} saiu da sala`);
        }
      }
    }
  }

  private parseCommand(text: string): { cmd: string; args: string[] } | null {
    const normalized = text.startsWith('|') ? '!' + text.slice(1) : text;
    if (!normalized.startsWith('!')) return null;
    const parts = normalized.slice(1).trim().split(/\s+/);
    return { cmd: (parts[0] || '').toLowerCase(), args: parts.slice(1) };
  }

  private async onMessage(message: string): Promise<void> {
    let match = message.match(/42\[20,(\d+),"((?:[^"\\]|\\.)*)"\]/);
    if (!match) {
      match = message.match(/42\[20,(\d+),(.+)\]/);
      if (match) {
        let text = match[2];
        if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1).replace(/\\"/g, '"');
        match = [match[0], match[1], text];
      }
    }
    if (!match) return;

    const playerId = parseInt(match[1]);
    if (playerId === 0) return;

    const text = (match[2] ?? '').trim();
    if (text.includes('!test') || text.includes('|test')) {
      await this.handleTestCommand(playerId, text);
      return;
    }

    const parsed = this.parseCommand(text);
    const room = this.getRoomForMode();
    if (!parsed) {
      const handled = await this.mode.handleCommand(room, playerId, '', [text.trim()]);
      if (handled) return;
      return;
    }

    const { cmd, args } = parsed;
    switch (cmd) {
      case 'r':
      case 'ready':
        await this.handleReadyCommand(playerId);
        break;
      case 'help':
      case 'h':
      case '?':
        await this.chat(this.mode.getHelpMessage());
        break;
      case 'ping':
        await this.chat('Pong!');
        break;
      case 'q':
      case 'queue':
        await this.handleQueueCommand();
        break;
      case 'd':
      case 'discord':
        await this.handleDiscordCommand();
        break;
      case 're':
      case 'reset':
        await this.handleResetCommand(playerId);
        break;
      case 'c':
      case 'cancel':
        await this.handleCancelCommand(playerId);
        break;
      case 'brbrr':
        await this.chat('!Patapim');
        break;
      case 'sortear':
        await this.handleVoteSortear(playerId);
        break;
      case 'kick':
        await this.handleVoteKick(playerId, args);
        break;
      case 'ban':
        await this.handleVoteBan(playerId, args);
        break;
      default: {
        const handled = await this.mode.handleCommand(room, playerId, cmd, args);
        if (!handled) await this.chat(this.mode.getHelpMessage());
        break;
      }
    }
  }

  private async handleTestCommand(playerId: number, _text: string): Promise<void> {
    const player = this.queue.get(playerId);
    const name = player?.username ?? `ID ${playerId}`;
    console.log(`[BonkRoom] 🧪 !test recebido de ${name} — integração OK`);
    await this.chat('Integração OK! Bot está recebendo comandos.');
  }

  private async handleReadyCommand(playerId: number): Promise<void> {
    if (this.state !== RoomState.READY && this.state !== RoomState.MAP_SELECTION) return;
    const player = this.queue.get(playerId);
    if (!player) return;
    player.readyCmd = true;
    console.log(`[BonkRoom] ✅ ${player.username} está pronto (!r)`);
    await this.checkReady(true);
  }


  private async handleQueueCommand(): Promise<void> {
    const names = Array.from(this.queue.values())
      .filter(p => p.inRoom)
      .map(p => p.username);
    await this.chat(names.length ? names.join(', ') : 'Queue is empty.');
  }

  private async handleDiscordCommand(): Promise<void> {
    const link = process.env.DISCORD_SERVER_LINK;
    if (link) await this.chat(link);
  }

  private async handleResetCommand(playerId: number): Promise<void> {
    if (this.state !== RoomState.GAME_STARTING && this.state !== RoomState.IN_GAME) return;
    const inGame = this.getInGamePlayers();
    if (!inGame.some(p => p.id === playerId)) return;
    if (this.voteReset.includes(playerId)) return;
    this.voteReset.push(playerId);
    if (this.voteReset.length < inGame.length) {
      await this.chat(`${this.voteReset.length}/${inGame.length} players voted for reset.`);
    } else {
      this.voteReset = [];
      const frame = await this.getGameFrame();
      if (frame) {
        await frame.evaluate(() => {
          const sgr = (window as any).sgrAPI;
          if (!sgr) return;
          if (sgr.nextScores !== undefined) sgr.nextScores = sgr.state?.scores ?? sgr.footballState?.scores;
          if (typeof sgr.startGame === 'function') sgr.startGame();
        });
      }
    }
  }

  private async handleCancelCommand(playerId: number): Promise<void> {
    if (this.state !== RoomState.GAME_STARTING && this.state !== RoomState.IN_GAME) return;
    const inGame = this.getInGamePlayers();
    if (!inGame.some(p => p.id === playerId)) return;
    if (this.voteCancel.includes(playerId)) return;
    this.voteCancel.push(playerId);
    if (this.voteCancel.length < inGame.length) {
      await this.chat(`${this.voteCancel.length}/${inGame.length} players voted to cancel.`);
    } else {
      await this.reset();
    }
  }

  private getInRoomPlayers(): Player[] {
    return Array.from(this.queue.values()).filter(p => p.inRoom);
  }

  private getVoteMajority(): number {
    const n = this.getInRoomPlayers().length;
    return Math.max(1, Math.ceil(n / 2));
  }

  private async handleVoteSortear(playerId: number): Promise<void> {
    if (Date.now() < this.voteCooldownUntil) {
      await this.chat('Aguarde antes de iniciar outra votação.');
      return;
    }
    const inRoom = this.getInRoomPlayers();
    if (inRoom.length < 2) {
      await this.chat('Precisam de pelo menos 2 jogadores para sortear times.');
      return;
    }
    if (!this.voteSortear) this.voteSortear = new Set();
    if (this.voteSortear.has(playerId)) {
      await this.chat('Você já votou para sortear os times.');
      return;
    }
    this.voteSortear.add(playerId);
    const majority = this.getVoteMajority();
    const total = inRoom.length;
    await this.chat(`Sortear times: ${this.voteSortear.size}/${total} votos (precisa ${majority}). Use !sortear para votar.`);
    if (this.voteSortear.size >= majority) {
      this.voteSortear = null;
      this.voteCooldownUntil = Date.now() + BonkRoom.VOTE_COOLDOWN_MS;
      await this.sortearTimes();
      await this.chat('Times sorteados!');
    }
  }

  private async handleVoteKick(playerId: number, args: string[]): Promise<void> {
    if (Date.now() < this.voteCooldownUntil) {
      await this.chat('Aguarde antes de iniciar outra votação.');
      return;
    }
    const query = args.join(' ').trim();
    if (!query) {
      await this.chat('Use !kick <abreviação do jogador>.');
      return;
    }
    const inRoom = this.getInRoomPlayers();
    const names = inRoom.map(p => p.username);
    const matches = fuzzyMatch(query, names);
    if (matches.length !== 1) {
      await this.chat('Digite !kick <abreviação> de um jogador (apenas uma correspondência).');
      return;
    }
    const target = inRoom.find(p => p.username === matches[0]);
    if (!target || target.id === playerId) {
      await this.chat('Você não pode votar para kick em si mesmo.');
      return;
    }
    if (this.voteKick && this.voteKick.targetId !== target.id) {
      await this.chat('Há outra votação de kick em andamento. Aguarde ou espere ela terminar.');
      return;
    }
    if (!this.voteKick) this.voteKick = { targetId: target.id, votes: new Set() };
    if (this.voteKick.votes.has(playerId)) {
      await this.chat('Você já votou para kick.');
      return;
    }
    this.voteKick.votes.add(playerId);
    const majority = this.getVoteMajority();
    const total = inRoom.length;
    await this.chat(`Kick ${target.username}: ${this.voteKick.votes.size}/${total} votos (precisa ${majority}). Use !kick ${query} para votar.`);
    if (this.voteKick.votes.size >= majority) {
      const id = this.voteKick.targetId;
      this.voteKick = null;
      this.voteCooldownUntil = Date.now() + BonkRoom.VOTE_COOLDOWN_MS;
      await this.kickPlayer(id);
      await this.chat(`${target.username} foi expulso da sala.`);
    }
  }

  private async handleVoteBan(playerId: number, args: string[]): Promise<void> {
    if (Date.now() < this.voteCooldownUntil) {
      await this.chat('Aguarde antes de iniciar outra votação.');
      return;
    }
    const query = args.join(' ').trim();
    if (!query) {
      await this.chat('Use !ban <abreviação do jogador>.');
      return;
    }
    const inRoom = this.getInRoomPlayers();
    const names = inRoom.map(p => p.username);
    const matches = fuzzyMatch(query, names);
    if (matches.length !== 1) {
      await this.chat('Digite !ban <abreviação> de um jogador (apenas uma correspondência).');
      return;
    }
    const target = inRoom.find(p => p.username === matches[0]);
    if (!target || target.id === playerId) {
      await this.chat('Você não pode votar para ban em si mesmo.');
      return;
    }
    if (this.voteBan && this.voteBan.targetId !== target.id) {
      await this.chat('Há outra votação de ban em andamento. Aguarde ou espere ela terminar.');
      return;
    }
    if (!this.voteBan) this.voteBan = { targetId: target.id, votes: new Set() };
    if (this.voteBan.votes.has(playerId)) {
      await this.chat('Você já votou para ban.');
      return;
    }
    this.voteBan.votes.add(playerId);
    const majority = this.getVoteMajority();
    const total = inRoom.length;
    await this.chat(`Ban ${target.username}: ${this.voteBan.votes.size}/${total} votos (precisa ${majority}). Use !ban ${query} para votar.`);
    if (this.voteBan.votes.size >= majority) {
      const id = this.voteBan.targetId;
      this.voteBan = null;
      this.voteCooldownUntil = Date.now() + BonkRoom.VOTE_COOLDOWN_MS;
      await this.banPlayer(id);
      await this.chat(`${target.username} foi banido da sala.`);
    }
  }

  private async kickPlayer(playerId: number): Promise<boolean> {
    const frame = await this.getGameFrame();
    if (!frame) return false;
    try {
      await frame.evaluate((id: number) => {
        const sgr = (window as any).sgrAPI;
        if (sgr?.toolFunctions?.networkEngine?.kickPlayer) sgr.toolFunctions.networkEngine.kickPlayer(id);
      }, playerId);
      return true;
    } catch {
      return false;
    }
  }

  private async banPlayer(playerId: number): Promise<boolean> {
    const frame = await this.getGameFrame();
    if (!frame) return false;
    try {
      await frame.evaluate((id: number) => {
        const sgr = (window as any).sgrAPI;
        if (sgr?.toolFunctions?.networkEngine?.banPlayer) sgr.toolFunctions.networkEngine.banPlayer(id);
      }, playerId);
      return true;
    } catch {
      return false;
    }
  }

  private async sortearTimes(): Promise<void> {
    const RED = 2;
    const BLUE = 3;
    const inGame = this.getInGamePlayers();
    if (inGame.length < 2) return;
    const shuffled = [...inGame].sort(() => Math.random() - 0.5);
    const half = Math.floor(shuffled.length / 2);
    const frame = await this.getGameFrame();
    if (!frame) return;
    for (let i = 0; i < shuffled.length; i++) {
      const team = i < half ? RED : BLUE;
      await this.changeOtherTeam(shuffled[i].id, team);
    }
    await this.allReadyReset();
  }

  private async checkReady(showChat: boolean): Promise<void> {
    const inGame = this.getInGamePlayers();
    const readyCount = inGame.filter(p => p.ready || p.readyCmd).length;
    const canStart = this.mode.canStart(this.getRoomForMode());

    if (readyCount >= inGame.length && inGame.length > 0 && canStart) {
      console.log('[BonkRoom] 🎯 Todos prontos! Iniciando partida...');
      this.voteReset = [];
      this.voteCancel = [];
      await this.startGame();
      this.clearTransitionTimer();
      this.state = RoomState.GAME_STARTING;
      console.log('[BonkRoom] 🚀 Estado: GAME_STARTING');
    } else if (showChat && inGame.length > 0) {
      await this.chat(`${readyCount}/${inGame.length} players ready.`);
    }
  }

  private getInGamePlayers(): Player[] {
    return this.mode.getInGamePlayers(this.getRoomForMode());
  }

  private async changeOtherTeam(playerId: number, team: number): Promise<boolean> {
    const frame = await this.getGameFrame();
    if (!frame) return false;
    try {
      const ok = await frame.evaluate((id: number, t: number) => {
        const sgr = (window as any).sgrAPI;
        if (!sgr?.toolFunctions?.networkEngine?.changeOtherTeam) return false;
        sgr.toolFunctions.networkEngine.changeOtherTeam(id, t);
        return true;
      }, playerId, team);
      return !!ok;
    } catch {
      return false;
    }
  }

  private async allReadyReset(): Promise<void> {
    const frame = await this.getGameFrame();
    if (!frame) return;
    try {
      await frame.evaluate(() => {
        const sgr = (window as any).sgrAPI;
        if (sgr?.toolFunctions?.networkEngine?.allReadyReset) sgr.toolFunctions.networkEngine.allReadyReset();
      });
    } catch (_) {}
  }

  private async loadMap(mapJson: string): Promise<void> {
    const frame = await this.getGameFrame();
    if (!frame) return;
    try {
      await frame.evaluate((json: string) => {
        const sgr = (window as any).sgrAPI;
        if (sgr?.loadMap) sgr.loadMap(JSON.parse(json));
      }, mapJson);
    } catch (_) {}
  }

  private async startGame(): Promise<void> {
    const frame = await this.getGameFrame();
    if (!frame) return;
    await frame.evaluate(() => {
      const sgr = (window as any).sgrAPI;
      if (sgr?.startGame) sgr.startGame();
    });
  }

  private async detectStateChanges(frame: any): Promise<void> {
    if (this.state !== RoomState.GAME_STARTING && this.state !== RoomState.IN_GAME) return;

    const inLobby = await frame.evaluate(() => {
      const lobby = document.getElementById('newbonklobby');
      return lobby && lobby.style.opacity === '1';
    });

    if (DEBUG_LOG && this.updateTickCount % 20 === 0) {
      logDebug('detectStateChanges', { state: this.state, inLobby });
    }

    if (this.state === RoomState.GAME_STARTING && !inLobby) {
      this.state = RoomState.IN_GAME;
      console.log('[BonkRoom] ✅ Partida iniciada! Estado: IN_GAME');
    }

    if (this.state === RoomState.IN_GAME && inLobby) {
      console.log('[BonkRoom] 🏁 Partida terminou');
      let winnerTeam: number | undefined;
      try {
        const scores = await frame.evaluate(() => {
          const sgr = (window as any).sgrAPI;
          const s = sgr?.footballState?.scores ?? sgr?.state?.scores;
          if (!s) return null;
          const red = s[2] ?? 0;
          const blue = s[3] ?? 0;
          return { red, blue };
        });
        if (scores && scores.red !== scores.blue) {
          winnerTeam = scores.red > scores.blue ? 2 : 3;
        }
      } catch (_) {}
      await this.mode.onGameEnd(this.getRoomForMode(), winnerTeam);
    }
  }

  private chatUnavailableLogged = false;

  private async chat(message: string): Promise<void> {
    try {
      const frame = await this.getGameFrame();
      if (!frame) return;

      const ok = await frame.evaluate((msg: string) => {
        const sgr = (window as any).sgrAPI;
        if (sgr?.toolFunctions?.networkEngine?.chatMessage) {
          sgr.toolFunctions.networkEngine.chatMessage(msg);
          return true;
        }
        return false;
      }, message);

      if (ok) this.chatUnavailableLogged = false;
      else if (!this.chatUnavailableLogged) {
        this.chatUnavailableLogged = true;
        console.warn('[BonkRoom] ⚠️ Chat não enviado: networkEngine ausente.');
      }
    } catch (_) {
      // Ignorar
    }
  }

  private async reset(): Promise<void> {
    console.log('[BonkRoom] 🔄 Resetando sala...');
    this.state = RoomState.IDLE;
    this.picker = undefined;
    this.picked = undefined;
    this.voteReset = [];
    this.voteCancel = [];
    this.voteKick = null;
    this.voteBan = null;
    this.voteSortear = null;
    for (const player of this.queue.values()) {
      player.readyCmd = false;
    }

    const frame = await this.getGameFrame();
    if (frame) {
      try {
        await frame.evaluate(() => {
          const sgr = (window as any).sgrAPI;
          if (sgr?.toolFunctions?.networkEngine?.allReadyReset) sgr.toolFunctions.networkEngine.allReadyReset();
        });
      } catch (_) {}
    }

    this.startTransitionTimer(5000);
    console.log('[BonkRoom] Estado: IDLE');
    console.log('[BonkRoom] Aguardando próximos jogadores...');
  }

  private startTransitionTimer(duration: number): void {
    this.clearTransitionTimer();
    
    this.transitionTimer = setTimeout(async () => {
      await this.onTransitionTimerExpired();
    }, duration);
  }

  private clearTransitionTimer(): void {
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = undefined;
    }
  }

  private async onTransitionTimerExpired(): Promise<void> {
    if (this.state === RoomState.IDLE) {
      await this.transitionFromIdle();
    } else if (this.state === RoomState.READY || this.state === RoomState.PICK) {
      console.log('[BonkRoom] ⏰ Tempo expirou, resetando...');
      await this.reset();
    }
  }

  private async transitionFromIdle(): Promise<void> {
    await this.mode.transitionFromIdle(this.getRoomForMode());
  }

  private async startMapSelection(): Promise<void> {
    await this.mode.startMapSelection(this.getRoomForMode());
    await this.checkReady(false);
  }

  private gameFrameCache: any = null;

  private async getGameFrame(): Promise<any> {
    if (this.gameFrameCache) {
      try {
        await this.gameFrameCache.evaluate(() => (window as any).sgrAPI != null);
        return this.gameFrameCache;
      } catch {
        if (DEBUG_LOG) logDebug('getGameFrame', { event: 'cache_invalid', reason: 'evaluate_failed' });
        this.gameFrameCache = null;
      }
    }
    const frames = this.page.frames();
    for (const frame of frames) {
      try {
        const info = await frame.evaluate(() => {
          const hasSgr = typeof (window as any).sgrAPI !== 'undefined';
          const hasLobby = document.getElementById('newbonklobby') != null;
          const url = window.location?.href ?? '';
          return { hasSgr, hasLobby, ok: hasSgr && hasLobby, url };
        });
        if (info.ok) {
          this.gameFrameCache = frame;
          if (DEBUG_LOG) logDebug('getGameFrame', { event: 'found_lobby_sgr', url: info.url?.slice(0, 55), framesCount: frames.length });
          return frame;
        }
      } catch (e) {
        continue;
      }
    }
    const fallback = frames.find(f => f.url().includes('gameframe') && f.url().includes('bonk.io'))
      || frames.find(f => f.url().includes('bonk.io'));
    if (fallback) {
      this.gameFrameCache = fallback;
      if (DEBUG_LOG) logDebug('getGameFrame', { event: 'fallback_url', url: fallback.url()?.slice(0, 55) });
    } else if (DEBUG_LOG) {
      logDebug('getGameFrame', { event: 'no_frame', framesCount: frames.length, urls: frames.map((f: any) => f.url?.()?.slice(0, 40)) });
    }
    return fallback;
  }

  async close(): Promise<void> {
    console.log('[BonkRoom] 🛑 Fechando sala...');
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.clearTransitionTimer();
    
    try {
      await this.chat('Room closed.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      // Ignorar erros ao fechar
    }
    
    await this.browser.close();
    console.log('[BonkRoom] ✅ Sala fechada');
  }

  getDebugInfo() {
    return {
      state: this.state,
      queueSize: this.queue.size,
      queuePlayers: Array.from(this.queue.values())
        .filter(p => p.inRoom)
        .map(p => p.username),
      match: {
        picker: this.picker?.username,
        picked: this.picked?.username,
      },
    };
  }
}
