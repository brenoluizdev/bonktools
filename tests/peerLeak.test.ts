import { describe, expect, it, vi } from 'vitest';
import pino from 'pino';
import { BonkRoom } from '../src/room/BonkRoom.js';
import { PeerBrokerClient } from '../src/webrtc/PeerBrokerClient.js';

/**
 * Vazamento de conexões P2P (sala da IA, 25/09/2026): a RTCPeerConnection de quem SAÍA da sala nunca era fechada. Numa
 * sala com muita rotatividade a CPU crescia sem parar (perfil: o sistema de eventos do werift no topo) até 100% —
 * ping alto, jogadores "voando", conexão com o bonk.io caindo.
 */
const logger = pino({ level: 'silent' });
const fakePc = () => ({ close: vi.fn(), connectionState: 'connected' });

describe('PeerBrokerClient.closePeer', () => {
  it('fecha a conexão do peer, tira do mapa e esquece a última mensagem dele (não é mais repassada a quem entra)', () => {
    const broker = new PeerBrokerClient('b2', 'bot', logger);
    const pcA = fakePc();
    const pcB = fakePc();
    broker['connections'].set('peerA', { pc: pcA as never, connectionId: 'c1', channel: null, disconnectTimer: null });
    broker['connections'].set('peerB', { pc: pcB as never, connectionId: 'c2', channel: null, disconnectTimer: null });
    broker['lastMessage'].set('peerA', Buffer.from([1]));

    broker.closePeer('peerA');

    expect(pcA.close).toHaveBeenCalledTimes(1);
    expect(pcB.close).not.toHaveBeenCalled();
    expect(broker.peerCount).toBe(1);
    expect(broker['lastMessage'].has('peerA')).toBe(false);
    broker.closePeer('peerA'); // repetido / desconhecido: nada acontece
    broker.closePeer('ninguem');
    expect(pcA.close).toHaveBeenCalledTimes(1);
  });

  it('cancela o temporizador de "disconnected" ao fechar', () => {
    vi.useFakeTimers();
    const broker = new PeerBrokerClient('b2', 'bot', logger);
    const pc = fakePc();
    const timer = setTimeout(() => undefined, 30_000);
    broker['connections'].set('peerA', { pc: pc as never, connectionId: 'c1', channel: null, disconnectTimer: timer });
    broker.closePeer('peerA');
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

describe('BonkRoom: PLAYER_LEAVE fecha a conexão P2P de quem saiu', () => {
  it('chama closePeer com o peerID do jogador que saiu', () => {
    const t = { on: vi.fn(), off: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), sendPacket: vi.fn(), getState: vi.fn().mockReturnValue('connected') };
    const room = new BonkRoom({ desiredState: { roomName: 'T', password: '', mode: 'f', rounds: 3 }, logger, transport: t as never });
    const closePeer = vi.fn();
    room['peerBroker'] = { closePeer } as never;
    room['handleIncomingPacket']([4, 7, 'peer7', 'Ana', true, 0, 5, false, false, { layers: [], bc: 0 }]);
    room['handleIncomingPacket']([5, 7]);
    expect(closePeer).toHaveBeenCalledWith('peer7');
    expect(room.state.players.has(7)).toBe(false);
  });
});
