/**
 * Lógica de transições entre estados da sala
 */

import { roomState } from "./roomState";
import { RoomState } from "./types";
import { MESSAGES } from "../messages";
import { TIMEOUTS } from "../config/room";

/**
 * Tenta iniciar a próxima partida se houver jogadores suficientes
 */
export function tryStartNextMatch(bot: any) {
  const state = roomState.getState();
  
  // Só iniciar se estiver em IDLE
  if (state !== RoomState.IDLE) {
    return false;
  }

  // Precisa de pelo menos 2 jogadores
  if (!roomState.canStartMatch()) {
    console.log("[Transitions] Aguardando mais jogadores...");
    return false;
  }

  const queue = roomState.getQueue();
  const picker = queue[0];
  
  if (!picker) return false;

  // Se só tem 2 jogadores, iniciar direto
  if (queue.length === 2) {
    const picked = queue[1];
    roomState.setPicker(picker);
    roomState.setPicked(picked);
    
    bot.chat(MESSAGES.MATCH_STARTING(picker.username, picked.username));
    bot.chat(`${picker.username}, entre no time vermelho.`);
    bot.chat(`${picked.username}, entre no time azul.`);
    
    roomState.setState(RoomState.READY);
    bot.chat(MESSAGES.USE_READY_COMMAND);
    
    // Timer para ready
    roomState.startTimer("ready", () => {
      bot.chat(MESSAGES.READY_TIMEOUT);
      roomState.reset();
      tryStartNextMatch(bot);
    }, TIMEOUTS.READY_TIME);
    
    return true;
  }

  // Mais de 2 jogadores: fase de pick
  roomState.setPicker(picker);
  roomState.setState(RoomState.PICK);
  
  bot.chat(MESSAGES.YOUR_TURN_TO_PICK(picker.username));
  bot.chat(MESSAGES.USE_PICK_COMMAND);
  
  // Timer para pick
  roomState.startTimer("pick", () => {
    bot.chat(MESSAGES.PICK_TIMEOUT(picker.username));
    roomState.removeFromQueue(picker.id);
    roomState.reset();
    tryStartNextMatch(bot);
  }, TIMEOUTS.PICK_TIME);
  
  return true;
}

/**
 * Processa o fim de uma partida
 */
export function handleMatchEnd(
  bot: any,
  winner: "picker" | "picked" | "tie"
) {
  const currentMatch = roomState.getCurrentMatch();
  
  if (!currentMatch.picker || !currentMatch.picked) {
    console.error("[Transitions] Match end sem jogadores definidos");
    return;
  }

  // Processar rating
  const { ratingSystem } = require("../rating");
  
  const winnerType = winner === "picker" ? "player1" : winner === "picked" ? "player2" : "tie";
  
  try {
    const result = ratingSystem.processMatch(
      currentMatch.picker.username,
      currentMatch.picked.username,
      winnerType
    );

    // Enviar mensagem com resultado
    if (winner === "tie") {
      bot.chat(MESSAGES.MATCH_TIE(
        result.player1.username,
        result.player1.newRating,
        result.player1.change,
        result.player2.username,
        result.player2.newRating,
        result.player2.change
      ));
    } else {
      const winnerResult = winner === "picker" ? result.player1 : result.player2;
      const loserResult = winner === "picker" ? result.player2 : result.player1;
      
      bot.chat(MESSAGES.MATCH_RESULT(
        winnerResult.username,
        winnerResult.newRating,
        winnerResult.change,
        loserResult.username,
        loserResult.newRating,
        loserResult.change
      ));
    }
  } catch (error) {
    console.error("[Transitions] Erro ao processar rating:", error);
  }

  // Rotacionar fila
  roomState.rotateQueue();
  
  // Resetar estado
  roomState.reset();
  
  // Tentar próxima partida
  setTimeout(() => {
    tryStartNextMatch(bot);
  }, 5000); // 5 segundos de delay
}

/**
 * Limpa o estado quando um jogador sai
 */
export function handlePlayerLeave(bot: any, playerId: number) {
  const state = roomState.getState();
  const currentMatch = roomState.getCurrentMatch();
  
  // Se o jogador que saiu está na partida atual
  const wasInMatch = 
    (currentMatch.picker && currentMatch.picker.id === playerId) ||
    (currentMatch.picked && currentMatch.picked.id === playerId);
  
  if (wasInMatch && state !== RoomState.IDLE) {
    // Cancelar partida se jogador importante sair
    bot.chat(MESSAGES.CANCELLING_MATCH);
    roomState.reset();
    
    setTimeout(() => {
      tryStartNextMatch(bot);
    }, 2000);
  }
  
  // Remover da fila de qualquer forma
  roomState.removeFromQueue(playerId);
}
