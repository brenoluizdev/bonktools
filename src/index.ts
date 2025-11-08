// src/index.ts
// API pública da biblioteca bonktools

import { BonkConnection } from './connection/BonkConnection';

// Exporta a classe principal para uso
export { BonkConnection };

// Exporta tipos úteis
export * from './connection/BonkConnection';

// Exporta constantes (opcional, mas útil para o desenvolvedor)
export * from './utils/constants';

// Exporta utilitários (opcional)
export * from './utils/validation';

/**
 * A classe principal da biblioteca BonkTools, que estende BonkConnection.
 * Serve como ponto de entrada para todas as funcionalidades da biblioteca.
 */
/**
 * A classe principal da biblioteca BonkTools, que estende BonkConnection.
 * Serve como ponto de entrada para todas as funcionalidades da biblioteca.
 *
 * @example
 * \`\`\`typescript
 * import BonkTools from 'bonktools';
 *
 * async function runBot() {
 *     const bot = new BonkTools({ username: 'GuestBot', guest: true });
 *     await bot.init();
 *     await bot.connect();
 *
 *     // Criar uma sala
 *     await bot.createRoom({ roomname: 'Minha Sala BonkTools' });
 *
 *     // Ouvir mensagens de chat
 *     bot.on('CHAT_MESSAGE', ({ player, message }) => {
 *         console.log(\`[\${player.username}]: \${message}\`);
 *         if (message === '!start') {
 *             bot.startGame();
 *         }
 *     });
 *
 *     console.log(\`Sala criada! Nome: \${bot.room.name}\`);
 * }
 *
 * runBot().catch(console.error);
 * \`\`\`
 */
export class BonkTools extends BonkConnection {
    /**
     * Cria uma nova instância de BonkTools.
     * @param account - As informações da conta (nome de usuário, senha, se é convidado).
     * @param server - O servidor Bonk.io para se conectar (opcional, padrão é 'b2ny1').
     */
    constructor(account: any, server?: string) {
        super(account, server);
    }
}

export default BonkTools;
