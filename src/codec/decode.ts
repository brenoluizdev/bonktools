import type { IncomingPacket } from './packets.js';
import { INCOMING_PACKET_IDS } from './packets.js';

// Pitfall 6: o socket.io-client@2 emite eventos com IDs numéricos e já desmonta
// o envelope "42[...]" em [N, ...args]. Este decode recebe o array, NÃO a string raw.
// Uso típico no transport: socket.on(N, (...args) => decode([N, ...args])).

/**
 * Decodifica um packet incoming do bonk.io (array [id, ...args]) em um objeto tipado.
 *
 * Defensivo (boundary server→codec): qualquer packet não mapeado retorna
 * `{ type: 'UNKNOWN', raw }` em vez de lançar (T-1-T1 mitigate).
 */
export function decode(packet: [number, ...unknown[]]): IncomingPacket {
  const [type, ...args] = packet;

  switch (type) {
    case INCOMING_PACKET_IDS.TIMESYNC: {
      const payload = args[0] as { result: number; id: number };
      return { type: 'TIMESYNC', time: payload.result, id: payload.id };
    }
    case INCOMING_PACKET_IDS.STATUS_MESSAGE:
      return { type: 'STATUS_MESSAGE', status: args[0] as string };
    case INCOMING_PACKET_IDS.SHARE_LINK:
      return {
        type: 'SHARE_LINK',
        roomId: args[0] as number,
        bypass: args[1] as string,
      };
    case INCOMING_PACKET_IDS.ROOM_CREATED:
      return {
        type: 'ROOM_CREATED',
        sockId: args[0] as string,
        myId: args[1] as number,
      };
    default:
      return { type: 'UNKNOWN', raw: packet };
  }
}
