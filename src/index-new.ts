import { RoomMaker } from './browser/roomMaker';
import { BonkRoom } from './room/bonkRoom';
import { ROOM_CONFIG } from './config/room';
import { getModeOrDefault } from './modes';
import { getRoomNameEnvKey, getFavoriteIndexForMode } from './config/modeConfig';
import { getMapJsonStringsForMode } from './config/maps';
require('dotenv').config();

(async () => {
  try {
    const modeId = (process.env.MODE ?? 'mbappa2x2').toLowerCase();
    const mode = getModeOrDefault(modeId);
    console.log('🤖 ====================================');
    console.log(`🤖 FUTHERO Bot - ${mode.name}`);
    console.log('🤖 ====================================\n');

    if (!process.env.BOT_PASSWORD) {
      console.error('❌ BOT_PASSWORD não definido no .env');
      process.exit(1);
    }

    console.log('📦 Inicializando RoomMaker...');
    const roomMaker = new RoomMaker();
    await roomMaker.init();

    const roomNameEnvKey = getRoomNameEnvKey(modeId);
    const roomName = (process.env[roomNameEnvKey] || ROOM_CONFIG.name).trim();
    const mapJsonStrings = getMapJsonStringsForMode(modeId);
    const roomParams = mode.getRoomParams({
      name: roomName,
      password: ROOM_CONFIG.password ?? '',
      maxPlayers: ROOM_CONFIG.maxPlayers,
      minLevel: ROOM_CONFIG.minLevel ?? 0,
      unlisted: ROOM_CONFIG.unlisted,
      maps: mapJsonStrings,
      favoriteIndex: getFavoriteIndexForMode(modeId),
    });
    console.log('\n🏗️  Criando sala no Bonk.io...');
    const { browser, page, roomLink, maps } = await roomMaker.createRoom(roomParams);

    console.log('\n✅ ====================================');
    console.log(`✅ Sala criada com sucesso!`);
    console.log(`✅ Link: ${roomLink}`);
    console.log('✅ ====================================\n');

    console.log('🎮 Iniciando gerenciamento da sala...\n');
    const bonkRoom = new BonkRoom(browser, page, { ...roomParams, maps }, mode);

    await bonkRoom.run();

    console.log('📝 Comandos gerais: !help !ping !queue !r !reset !cancel');
    console.log(`   Modo ${mode.name}: veja !help no chat.\n`);

    process.on('unhandledRejection', (reason) => {
      console.error('[Bot] ⚠️ Unhandled rejection (bot continua rodando):', reason);
    });

    process.on('SIGINT', async () => {
      console.log('\n\n⏹️  Encerrando bot...');
      await bonkRoom.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\n⏹️  Encerrando bot...');
      await bonkRoom.close();
      process.exit(0);
    });

  } catch (err) {
    console.error('\n❌ ====================================');
    console.error('❌ Erro fatal:', err);
    console.error('❌ ====================================');
    process.exit(1);
  }
})();
