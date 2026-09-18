import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import pino from 'pino';

// ── Mocks: ws e werift, sem rede/WebRTC real ────────────────────────────────

class FakeWebSocket extends EventEmitter {
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;
  readyState = FakeWebSocket.OPEN;
  sent: string[] = [];
  url: string;

  constructor(url: string) {
    super();
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3; // CLOSED
    this.emit('close');
  }

  static instances: FakeWebSocket[] = [];
}

class FakePeerConnection {
  onicecandidate: ((event: { candidate: { candidate: string; sdpMid: string; sdpMLineIndex: number } | null }) => void) | null = null;
  ondatachannel: (() => void) | null = null;
  localDescription: { sdp: string; type: string } | null = null;
  closed = false;
  addIceCandidateCalls: unknown[] = [];

  async setRemoteDescription(): Promise<void> {}

  async createAnswer(): Promise<{ sdp: string; type: 'answer' }> {
    return { sdp: 'fake-answer-sdp', type: 'answer' };
  }

  async setLocalDescription(desc: { sdp: string; type: string }): Promise<void> {
    this.localDescription = desc;
  }

  async addIceCandidate(candidate: unknown): Promise<void> {
    this.addIceCandidateCalls.push(candidate);
  }

  close(): void {
    this.closed = true;
  }

  static instances: FakePeerConnection[] = [];
}

vi.mock('ws', () => ({ default: FakeWebSocket }));
vi.mock('werift', () => ({
  RTCPeerConnection: vi.fn().mockImplementation(() => {
    const pc = new FakePeerConnection();
    FakePeerConnection.instances.push(pc);
    return pc;
  }),
}));

const { PeerBrokerClient } = await import('../src/webrtc/PeerBrokerClient.js');

const silentLogger = pino({ level: 'silent' });

function lastSocket(): FakeWebSocket {
  return FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!;
}

function lastPc(): FakePeerConnection {
  return FakePeerConnection.instances[FakePeerConnection.instances.length - 1]!;
}

/** Deixa as promises encadeadas em handleOffer (setRemoteDescription → createAnswer → setLocalDescription → send) resolverem. */
async function flushAsync(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  FakePeerConnection.instances = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PeerBrokerClient — conexão ao broker', () => {
  it('conecta na URL correta (server, key=peerjs, id=peerID)', () => {
    const client = new PeerBrokerClient('b2seattle1', 'abc123def0a00000', silentLogger);
    client.connect();

    const url = lastSocket().url;
    expect(url).toContain('wss://b2seattle1.bonk.io/myapp/peerjs');
    expect(url).toContain('key=peerjs');
    expect(url).toContain('id=abc123def0a00000');
    client.disconnect();
  });

  it('inicia heartbeat periódico após "open"', () => {
    vi.useFakeTimers();
    const client = new PeerBrokerClient('b2seattle1', 'peer1a00000', silentLogger);
    client.connect();
    lastSocket().emit('open');

    vi.advanceTimersByTime(5000);
    expect(lastSocket().sent).toContainEqual(JSON.stringify({ type: 'HEARTBEAT' }));

    client.disconnect();
  });
});

describe('PeerBrokerClient — handshake OFFER/ANSWER', () => {
  it('responde OFFER com ANSWER usando o SDP gerado pela RTCPeerConnection', async () => {
    const client = new PeerBrokerClient('b2seattle1', 'myPeerId0000000', silentLogger);
    client.connect();
    const ws = lastSocket();

    ws.emit('message', Buffer.from(JSON.stringify({
      type: 'OFFER',
      src: 'remotePeer000000',
      dst: 'myPeerId0000000',
      payload: {
        sdp: { sdp: 'fake-offer-sdp', type: 'offer' },
        type: 'data',
        connectionId: 'dc_test123',
      },
    })));
    await flushAsync();

    const answerMsg = JSON.parse(ws.sent[ws.sent.length - 1]!);
    expect(answerMsg).toEqual({
      type: 'ANSWER',
      dst: 'remotePeer000000',
      payload: {
        sdp: { sdp: 'fake-answer-sdp', type: 'answer' },
        type: 'data',
        connectionId: 'dc_test123',
      },
    });

    client.disconnect();
  });

  it('repassa CANDIDATE recebido pra RTCPeerConnection correspondente', async () => {
    const client = new PeerBrokerClient('b2seattle1', 'myPeerId0000000', silentLogger);
    client.connect();
    const ws = lastSocket();

    ws.emit('message', Buffer.from(JSON.stringify({
      type: 'OFFER',
      src: 'remotePeer000000',
      dst: 'myPeerId0000000',
      payload: { sdp: { sdp: 'x', type: 'offer' }, type: 'data', connectionId: 'dc_1' },
    })));
    await flushAsync();
    expect(FakePeerConnection.instances.length).toBe(1);

    ws.emit('message', Buffer.from(JSON.stringify({
      type: 'CANDIDATE',
      src: 'remotePeer000000',
      dst: 'myPeerId0000000',
      payload: {
        candidate: { candidate: 'candidate:1 1 udp...', sdpMid: '0', sdpMLineIndex: 0 },
        type: 'data',
        connectionId: 'dc_1',
      },
    })));
    await flushAsync();

    expect(lastPc().addIceCandidateCalls.length).toBe(1);

    client.disconnect();
  });

  it('envia CANDIDATE local pro broker quando onicecandidate dispara', async () => {
    const client = new PeerBrokerClient('b2seattle1', 'myPeerId0000000', silentLogger);
    client.connect();
    const ws = lastSocket();

    ws.emit('message', Buffer.from(JSON.stringify({
      type: 'OFFER',
      src: 'remotePeer000000',
      dst: 'myPeerId0000000',
      payload: { sdp: { sdp: 'x', type: 'offer' }, type: 'data', connectionId: 'dc_1' },
    })));
    await flushAsync();
    expect(FakePeerConnection.instances.length).toBe(1);

    lastPc().onicecandidate?.({ candidate: { candidate: 'candidate:2 1 udp...', sdpMid: '0', sdpMLineIndex: 0 } });

    const candidateMsg = JSON.parse(ws.sent[ws.sent.length - 1]!);
    expect(candidateMsg).toMatchObject({
      type: 'CANDIDATE',
      dst: 'remotePeer000000',
      payload: { connectionId: 'dc_1' },
    });

    client.disconnect();
  });

  it('ignora mensagem CANDIDATE cujo peer não existe (sem crash)', () => {
    const client = new PeerBrokerClient('b2seattle1', 'myPeerId0000000', silentLogger);
    client.connect();
    const ws = lastSocket();

    expect(() => {
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'CANDIDATE',
        src: 'unknownPeer00000',
        dst: 'myPeerId0000000',
        payload: { candidate: { candidate: 'x' }, type: 'data', connectionId: 'dc_x' },
      })));
    }).not.toThrow();

    client.disconnect();
  });
});

describe('PeerBrokerClient — disconnect', () => {
  it('fecha todas as RTCPeerConnection e o socket do broker', async () => {
    const client = new PeerBrokerClient('b2seattle1', 'myPeerId0000000', silentLogger);
    client.connect();
    const ws = lastSocket();

    ws.emit('message', Buffer.from(JSON.stringify({
      type: 'OFFER',
      src: 'remotePeer000000',
      dst: 'myPeerId0000000',
      payload: { sdp: { sdp: 'x', type: 'offer' }, type: 'data', connectionId: 'dc_1' },
    })));
    await flushAsync();

    client.disconnect();

    expect(lastPc().closed).toBe(true);
    expect(ws.readyState).toBe(3);
  });
});
