// src/connection/PacketBuilder.ts
// Lógica de serialização de pacotes (baseada no bonkbot original)

/**
 * Classe utilitária para construir pacotes a serem enviados ao servidor Bonk.io.
 * O Bonk.io usa o formato PSON (Protocol-Specific Object Notation) para a maioria dos pacotes.
 */
export class PacketBuilder {
    /**
     * Constrói um pacote para envio.
     * @param {number} type - O tipo de mensagem (do CLIENT_MESSAGE_TYPES).
     * @param {any} data - Os dados a serem serializados.
     * @returns {any} O pacote serializado (geralmente um array).
     */
    public static build(type: number, data: any): any {
        // O bonkbot original usa um array onde o primeiro elemento é o tipo
        // e o segundo é o objeto de dados. A serialização PSON é feita
        // automaticamente pelo socket.io-client v2.x, que era a versão usada no bonkbot.
        // Vamos manter essa estrutura.
        return [type, data];
    }
}
