import BonkTools, { SERVER_MESSAGE_TYPES } from 'bonktools';

const account = {
    username: 'BonkToolsBot',
    guest: true,
};

async function runBot() {
    console.log('Iniciando BonkTools...');
    
    // 1. Criar uma instância do bot
    const bot = new BonkTools(account);

    // 2. Configurar ouvintes de eventos
    bot.on('ready', () => {
        console.log('Bot pronto para conectar.');

        bot.on('ROOM_SHARE_LINK', (data) => {
            console.log(data);
            console.log(`Room Link: ${data}`);
        })

        bot.connect();
    });

    bot.on('connect', () => {
        console.log('Conectado ao servidor Bonk.io!');
        
        // 4. Criar uma sala após a conexão
        bot.createRoom({
            roomname: 'Sala de Teste BonkTools',
            maxplayers: 8,
            password: '123',
        }).then(() => {
            console.log(`Sala criada! Nome: ${bot.room.name} no servidor ${bot.room.server}`);
            
            // 5. Enviar uma mensagem de chat após um pequeno atraso
            setTimeout(() => {
                bot.sendChat('Olá! Eu sou o BonkTools Bot!');
            }, 2000);

        }).catch(err => {
            console.error('Erro ao criar sala:', err.message);
            bot.disconnect();
        });
    });

    bot.on('disconnect', (reason) => {
        console.log(`Desconectado do servidor. Motivo: ${reason}`);
    });

    bot.on('error', (error) => {
        console.error('Erro na conexão:', error.message);
    });

    bot.on('CHAT_MESSAGE', ({ player, message }) => {
        console.log(`[CHAT] ${player.username}: ${message}`);
        if (message.toLowerCase() === '!start') {
            console.log('Comando !start recebido. Iniciando jogo...');
            bot.startGame();
        }
    });

    bot.on('packet', (packet) => {
        // Você pode inspecionar todos os pacotes aqui para depuração
        // console.log('Pacote recebido:', packet.type);
        
        // Exemplo de manipulação de um pacote específico
        if (packet.type === SERVER_MESSAGE_TYPES.ROOM_SHARE_LINK) {
            console.log(`ID da Sala: ${bot.room.dbid} (Link: ${bot.room.bypass})`);
        }
    });

    // 3. Inicializar e conectar
    try {
        await bot.init();
        await bot.connect();
    } catch (error: any) {
        console.error('Falha na inicialização ou conexão:', error);
    }
}

runBot();
