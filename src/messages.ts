/**
 * Mensagens do bot em PT-BR
 * Centraliza todas as strings para facilitar manutenção
 */

export const MESSAGES = {
  // Inicialização
  BOT_READY: "✅ Bot pronto (conta Bonk.io). Conectando e criando sala...",
  CONNECTED: "🔌 Conectado ao servidor.",
  ROOM_CREATED: "🟢 Sala criada. O bot é o host.",
  CONNECTION_ERROR: "❌ Erro ao conectar ou criar sala:",
  
  // Boas-vindas
  WELCOME: (username: string) => `👋 Bem-vindo à FUTHERO, ${username}!`,
  DEV_WARNING: "⚠️ Lembre-se: Essa sala está em desenvolvimento e pode apresentar bugs.",
  DISCORD_LINK: "ℹ️ Faça parte da nossa comunidade no Discord: https://discord.gg/qRJ4UCMfja",
  
  // Fila e estados
  PLAYER_LEFT: (username: string) => `👋 ${username} saiu da sala.`,
  GAME_ENDED: "🎉 O jogo acabou!",
  QUEUE_LIST: (players: string[]) => `📋 Fila (${players.length}): ${players.join(", ")}`,
  QUEUE_EMPTY: "📋 A fila está vazia.",
  ADDED_TO_QUEUE: (username: string) => `✅ ${username} foi adicionado à fila.`,
  
  // Pick/escolha
  YOUR_TURN_TO_PICK: (username: string) => `🎯 ${username}, é sua vez de escolher um adversário!`,
  USE_PICK_COMMAND: "💡 Use !p <nome> ou !escolher <nome> para escolher.",
  PLAYER_PICKED: (picker: string, picked: string) => `✅ ${picker} escolheu ${picked}!`,
  NO_MATCH_FOUND: "❌ Nenhum jogador encontrado com esse nome.",
  MULTIPLE_MATCHES: "❌ Múltiplos jogadores encontrados. Seja mais específico.",
  NOT_YOUR_TURN: (username: string) => `❌ É a vez de ${username} escolher.`,
  PICK_TIMEOUT: (username: string) => `⏱️ Tempo esgotado! ${username} foi removido da fila.`,
  
  // Ready
  USE_READY_COMMAND: "💡 Use !r ou !pronto quando estiver pronto.",
  PLAYER_READY: (username: string, ready: number, total: number) => 
    `✅ ${username} está pronto! (${ready}/${total})`,
  ALL_READY: "✅ Todos prontos! Iniciando partida...",
  READY_TIMEOUT: "⏱️ Tempo esgotado! Partida cancelada.",
  
  // Partida
  MATCH_STARTING: (player1: string, player2: string) => `🎮 Próxima partida: ${player1} vs ${player2}`,
  MATCH_RESULT: (winner: string, winnerRating: number, winnerChange: number, 
                 loser: string, loserRating: number, loserChange: number) =>
    `🏆 Vitória de ${winner}!\n` +
    `${winner}: ${Math.round(winnerRating)} (${winnerChange >= 0 ? '+' : ''}${Math.round(winnerChange)})\n` +
    `${loser}: ${Math.round(loserRating)} (${loserChange >= 0 ? '+' : ''}${Math.round(loserChange)})`,
  MATCH_TIE: (player1: string, rating1: number, change1: number,
              player2: string, rating2: number, change2: number) =>
    `🤝 Empate!\n` +
    `${player1}: ${Math.round(rating1)} (${change1 >= 0 ? '+' : ''}${Math.round(change1)})\n` +
    `${player2}: ${Math.round(rating2)} (${change2 >= 0 ? '+' : ''}${Math.round(change2)})`,
  
  // Reset/Cancel
  VOTE_RESET: (votes: number, total: number) => `🔄 Voto para reiniciar: ${votes}/${total}`,
  RESETTING_MATCH: "🔄 Reiniciando partida com mesmo placar...",
  VOTE_CANCEL: (votes: number, total: number) => `❌ Voto para cancelar: ${votes}/${total}`,
  CANCELLING_MATCH: "❌ Partida cancelada!",
  
  // Rating
  PLAYER_RATING: (username: string, rating: number, wins: number, losses: number, ties: number) =>
    `📊 ${username}: ${Math.round(rating)} pontos (V: ${wins}, D: ${losses}, E: ${ties})`,
  RATING_NOT_FOUND: (username: string) => `❌ ${username} ainda não jogou nenhuma partida ranqueada.`,
  TOP_PLAYERS: (count: number) => `🏆 Top ${count} jogadores:`,
  NO_PLAYERS_YET: "📊 Ainda não há jogadores ranqueados.",
  
  // Ajuda
  HELP_TITLE: "📖 Comandos disponíveis:",
  HELP_QUEUE: "!fila - Ver a fila de jogadores",
  HELP_PICK: "!p <nome> - Escolher adversário (quando for sua vez)",
  HELP_READY: "!r ou !pronto - Marcar como pronto",
  HELP_RESET: "!reset - Votar para reiniciar com mesmo placar",
  HELP_CANCEL: "!cancelar - Votar para cancelar partida",
  HELP_RATING: "!rating [nome] - Ver rating de um jogador",
  HELP_TOP: "!top [N] - Ver top N do ranking (padrão: 10)",
  HELP_DISCORD: "!discord - Link do servidor Discord",
  HELP_AJUDA: "!ajuda - Ver esta mensagem",
  
  // Erros
  COMMAND_NOT_FOUND: "❌ Comando não encontrado. Use !ajuda para ver os comandos disponíveis.",
  NOT_IN_GAME: "❌ Você não está em uma partida.",
  ALREADY_IN_QUEUE: "❌ Você já está na fila.",
  NOT_IN_QUEUE: "❌ Você não está na fila.",
  GAME_IN_PROGRESS: "❌ Há uma partida em andamento.",
  
  // Estados
  STATE_IDLE: "💤 Aguardando jogadores na fila...",
  STATE_PICK: "🎯 Fase de escolha de adversário",
  STATE_READY: "⏳ Aguardando jogadores ficarem prontos",
  STATE_GAME: "🎮 Partida em andamento",
};

export const HELP_TEXT = `${MESSAGES.HELP_TITLE}
${MESSAGES.HELP_QUEUE}
${MESSAGES.HELP_PICK}
${MESSAGES.HELP_READY}
${MESSAGES.HELP_RESET}
${MESSAGES.HELP_CANCEL}
${MESSAGES.HELP_RATING}
${MESSAGES.HELP_TOP}
${MESSAGES.HELP_DISCORD}
${MESSAGES.HELP_AJUDA}`;
