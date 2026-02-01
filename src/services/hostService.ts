/**
 * Serviço de host: verifica se o bot é o host da sala.
 * Usa apenas estado do bonkbot (sem DOM).
 */

export function isHost(bot: { game?: { id?: number; host?: number } }): boolean {
  return (
    bot.game?.id !== undefined &&
    bot.game?.host !== undefined &&
    bot.game.id === bot.game.host
  );
}
