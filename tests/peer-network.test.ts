import { describe, expect, it } from 'vitest';
import { parseIceCandidate } from '../src/webrtc/PeerBrokerClient.js';

describe('parseIceCandidate', () => {
  it('srflx IPv4 (o IP público do jogador)', () => {
    expect(parseIceCandidate('candidate:842163049 1 udp 1677729535 177.10.20.30 54321 typ srflx raddr 192.168.0.5 rport 54321 generation 0')).toEqual({
      protocol: 'udp',
      address: '177.10.20.30',
      port: 54321,
      type: 'srflx',
    });
  });
  it('host com nome mDNS oculto e IPv6', () => {
    expect(parseIceCandidate('candidate:1 1 udp 2113937151 a1b2-c3d4.local 50000 typ host generation 0')).toMatchObject({ address: 'a1b2-c3d4.local', type: 'host' });
    expect(parseIceCandidate('candidate:2 1 udp 2113937151 2804:14c:1::9 50001 typ host')).toMatchObject({ address: '2804:14c:1::9', port: 50001 });
  });
  it('lixo devolve null', () => {
    expect(parseIceCandidate('nada a ver')).toBeNull();
    expect(parseIceCandidate('')).toBeNull();
  });
});
