/**
 * Gerenciador de estado da sala
 * Mantém o estado atual, fila de jogadores, e controla transições
 */

import { RoomState, Player, MatchPlayers, VoteSystem } from "./types";
import { MESSAGES } from "../messages";
import { TIMEOUTS } from "../config/room";

class RoomStateManager {
  private state: RoomState = RoomState.IDLE;
  private queue: Player[] = [];
  private currentMatch: MatchPlayers = {};
  private votes: VoteSystem = { reset: new Set(), cancel: new Set() };
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private botInstance: any = null;

  /**
   * Inicializa o gerenciador com a instância do bot
   */
  init(bot: any) {
    this.botInstance = bot;
  }

  /**
   * Obtém o estado atual
   */
  getState(): RoomState {
    return this.state;
  }

  /**
   * Define o estado atual
   */
  setState(newState: RoomState) {
    console.log(`[Estado] Mudando de ${this.state} para ${newState}`);
    this.state = newState;
  }

  /**
   * Obtém a fila
   */
  getQueue(): Player[] {
    return [...this.queue];
  }

  /**
   * Obtém os jogadores da partida atual
   */
  getCurrentMatch(): MatchPlayers {
    return { ...this.currentMatch };
  }

  /**
   * Adiciona um jogador à fila
   */
  addToQueue(player: Player): boolean {
    // Verifica se já está na fila
    if (this.queue.find(p => p.id === player.id)) {
      return false;
    }

    this.queue.push(player);
    console.log(`[Fila] ${player.username} adicionado. Total: ${this.queue.length}`);
    return true;
  }

  /**
   * Remove um jogador da fila
   */
  removeFromQueue(playerId: number): Player | undefined {
    const index = this.queue.findIndex(p => p.id === playerId);
    if (index === -1) return undefined;

    const removed = this.queue.splice(index, 1)[0];
    console.log(`[Fila] ${removed.username} removido. Total: ${this.queue.length}`);
    return removed;
  }

  /**
   * Busca um jogador na fila por ID
   */
  getPlayerById(playerId: number): Player | undefined {
    return this.queue.find(p => p.id === playerId);
  }

  /**
   * Busca jogadores na fila usando busca fuzzy
   */
  findPlayersByName(query: string): Player[] {
    if (!query || query.length === 0) return [];

    const queryLower = query.toLowerCase();
    
    // Busca exata
    const exactMatch = this.queue.find(
      p => p.username.toLowerCase() === queryLower
    );
    if (exactMatch) return [exactMatch];

    // Busca por início
    const startsWithMatches = this.queue.filter(
      p => p.username.toLowerCase().startsWith(queryLower)
    );
    if (startsWithMatches.length > 0) return startsWithMatches;

    // Busca fuzzy (contém a query)
    const containsMatches = this.queue.filter(
      p => p.username.toLowerCase().includes(queryLower)
    );

    return containsMatches;
  }

  /**
   * Define o picker da partida atual
   */
  setPicker(player: Player) {
    this.currentMatch.picker = player;
    console.log(`[Match] Picker: ${player.username}`);
  }

  /**
   * Define o picked da partida atual
   */
  setPicked(player: Player) {
    this.currentMatch.picked = player;
    console.log(`[Match] Picked: ${player.username}`);
  }

  /**
   * Limpa a partida atual
   */
  clearMatch() {
    this.currentMatch = {};
    this.votes.reset.clear();
    this.votes.cancel.clear();
  }

  /**
   * Move os jogadores da partida para o fim da fila
   */
  rotateQueue() {
    const { picker, picked } = this.currentMatch;
    
    if (picker) {
      this.removeFromQueue(picker.id);
      this.queue.push(picker);
    }
    
    if (picked) {
      this.removeFromQueue(picked.id);
      this.queue.push(picked);
    }

    console.log(`[Fila] Rotacionada. Nova ordem: ${this.queue.map(p => p.username).join(", ")}`);
  }

  /**
   * Adiciona voto para reset
   */
  addResetVote(playerId: number): { current: number; total: number } {
    this.votes.reset.add(playerId);
    const total = this.getMatchPlayersCount();
    return { current: this.votes.reset.size, total };
  }

  /**
   * Adiciona voto para cancelar
   */
  addCancelVote(playerId: number): { current: number; total: number } {
    this.votes.cancel.add(playerId);
    const total = this.getMatchPlayersCount();
    return { current: this.votes.cancel.size, total };
  }

  /**
   * Verifica se todos votaram para reset
   */
  hasAllResetVotes(): boolean {
    const total = this.getMatchPlayersCount();
    return this.votes.reset.size >= total && total > 0;
  }

  /**
   * Verifica se todos votaram para cancelar
   */
  hasAllCancelVotes(): boolean {
    const total = this.getMatchPlayersCount();
    return this.votes.cancel.size >= total && total > 0;
  }

  /**
   * Obtém o número de jogadores na partida atual
   */
  private getMatchPlayersCount(): number {
    let count = 0;
    if (this.currentMatch.picker) count++;
    if (this.currentMatch.picked) count++;
    return count;
  }

  /**
   * Inicia um timer
   */
  startTimer(name: string, callback: () => void, duration: number) {
    this.clearTimer(name);
    const timer = setTimeout(callback, duration);
    this.timers.set(name, timer);
    console.log(`[Timer] ${name} iniciado (${duration}ms)`);
  }

  /**
   * Limpa um timer
   */
  clearTimer(name: string) {
    const timer = this.timers.get(name);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(name);
      console.log(`[Timer] ${name} cancelado`);
    }
  }

  /**
   * Limpa todos os timers
   */
  clearAllTimers() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    console.log(`[Timer] Todos os timers cancelados`);
  }

  /**
   * Verifica se há jogadores suficientes para iniciar
   */
  canStartMatch(): boolean {
    return this.queue.length >= 2;
  }

  /**
   * Reseta o estado da sala
   */
  reset() {
    console.log("[Estado] Resetando sala...");
    this.clearMatch();
    this.clearAllTimers();
    this.setState(RoomState.IDLE);
  }

  /**
   * Obtém informações de debug
   */
  getDebugInfo() {
    return {
      state: this.state,
      queueSize: this.queue.length,
      queuePlayers: this.queue.map(p => p.username),
      match: {
        picker: this.currentMatch.picker?.username,
        picked: this.currentMatch.picked?.username,
      },
      votes: {
        reset: this.votes.reset.size,
        cancel: this.votes.cancel.size,
      },
      timers: Array.from(this.timers.keys()),
    };
  }
}

// Singleton
export const roomState = new RoomStateManager();
