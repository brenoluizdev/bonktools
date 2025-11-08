// src/connection/PacketParser.ts
// Lógica de desserialização de pacotes (baseada no bonkbot original)

/**
 * Classe utilitária para analisar pacotes recebidos do servidor Bonk.io.
 */
export class PacketParser {
    /**
     * Analisa um pacote PSON recebido.
     * @param {any} data - O pacote bruto recebido do socket.
     * @returns {{type: number, data: any}} Um objeto contendo o tipo e os dados do pacote.
     */
    public static parse(data: any): { type: number; data: any } {
        // O bonkbot original recebe um array onde o primeiro elemento é o tipo
        // e o segundo é o objeto de dados.
        if (Array.isArray(data) && data.length > 0) {
            const [type, packetData] = data;
            return { type, data: packetData };
        }

        // Se o pacote não for um array [type, data], retornamos o tipo -1 (desconhecido)
        return { type: -1, data: data };
    }
}
