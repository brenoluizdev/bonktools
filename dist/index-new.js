"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const roomMaker_1 = require("./browser/roomMaker");
const bonkRoom_1 = require("./room/bonkRoom");
const room_1 = require("./config/room");
const modes_1 = require("./modes");
const modeConfig_1 = require("./config/modeConfig");
const maps_1 = require("./config/maps");
require('dotenv').config();
(async () => {
    try {
        const modeId = (process.env.MODE ?? 'mbappa2x2').toLowerCase();
        const mode = (0, modes_1.getModeOrDefault)(modeId);
        console.log('🤖 ====================================');
        console.log(`🤖 FUTHERO Bot - ${mode.name}`);
        console.log('🤖 ====================================\n');
        if (!process.env.BOT_PASSWORD) {
            console.error('❌ BOT_PASSWORD não definido no .env');
            process.exit(1);
        }
        console.log('📦 Inicializando RoomMaker...');
        const roomMaker = new roomMaker_1.RoomMaker();
        await roomMaker.init();
        const roomNameEnvKey = (0, modeConfig_1.getRoomNameEnvKey)(modeId);
        const roomName = (process.env[roomNameEnvKey] || room_1.ROOM_CONFIG.name).trim();
        const mapJsonStrings = (0, maps_1.getMapJsonStringsForMode)(modeId);
        const roomParams = mode.getRoomParams({
            name: roomName,
            password: room_1.ROOM_CONFIG.password ?? '',
            maxPlayers: room_1.ROOM_CONFIG.maxPlayers,
            minLevel: room_1.ROOM_CONFIG.minLevel ?? 0,
            unlisted: room_1.ROOM_CONFIG.unlisted,
            maps: mapJsonStrings,
        });
        console.log('\n🏗️  Criando sala no Bonk.io...');
        const { browser, page, roomLink, maps } = await roomMaker.createRoom(roomParams);
        console.log('\n✅ ====================================');
        console.log(`✅ Sala criada com sucesso!`);
        console.log(`✅ Link: ${roomLink}`);
        console.log('✅ ====================================\n');
        console.log('🎮 Iniciando gerenciamento da sala...\n');
        const bonkRoom = new bonkRoom_1.BonkRoom(browser, page, { ...roomParams, maps }, mode);
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
    }
    catch (err) {
        console.error('\n❌ ====================================');
        console.error('❌ Erro fatal:', err);
        console.error('❌ ====================================');
        process.exit(1);
    }
})();
