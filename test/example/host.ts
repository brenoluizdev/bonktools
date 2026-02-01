import { createBot, LOG_LEVELS } from 'bonktools';

const bot = createBot({
  account: {
    guest: true,
    username: 'MeuBot'
  },
  logLevel: LOG_LEVELS.INFO,
  PROTOCOL_VERSION: 49
});

await bot.init();
await bot.connect();
await bot.createRoom({ roomname: 'Minha Sala' });

// Eventos
bot.events.on('CHAT_MESSAGE', ({ player, message }) => {
  console.log(`${player.username}: ${message}`);
});
