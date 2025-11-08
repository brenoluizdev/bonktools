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
