/**
 * PeerBrokerClient — participa do handshake WebRTC/PeerJS que o bonk.io usa pra
 * sincronizar a partida ao vivo entre os clients (peer-to-peer, fora do Socket.IO).
 *
 * Descoberto via captura de tráfego real (não documentado antes): quando um jogador
 * entra numa sala, o client dele abre uma conexão WebRTC com CADA peer já presente —
 * inclusive o host, mesmo que o host nunca jogue. Sem essa lib, o host do bonktools
 * nunca respondia a esse handshake: o OFFER endereçado a ele expirava
 * (`{"type":"EXPIRE",...}`) e o jogador ficava sem conseguir renderizar a partida.
 *
 * Confirmado comparando: (a) host real (navegador) responde ANSWER normalmente, sem
 * EXPIRE; (b) host bonktools sem esta lib, mesmo OFFER expira. Ver BONK_PROTOCOL.md.
 *
 * Escopo (Fase A): só completar o handshake de sinalização (OPEN/OFFER/ANSWER/
 * CANDIDATE/HEARTBEAT) pra não deixar a conexão expirar. NÃO relaya dados de física
 * pelo DataChannel — se isso for necessário (Fase B), é trabalho futuro.
 *
 * Protocolo: servidor PeerJS padrão, sem customização (key="peerjs", formato de
 * id/token idêntico ao client PeerJS oficial) — confirmado inspecionando a URL de
 * conexão real: wss://<server>.bonk.io/myapp/peerjs?key=peerjs&id=<peerID>&token=<token>.
 */

import { EventEmitter } from 'eventemitter3';
import WebSocket from 'ws';
import { RTCPeerConnection } from 'werift';
import type { RTCDataChannel } from 'werift';
import type { Logger } from 'pino';

const HEARTBEAT_INTERVAL_MS = 5000;
const RECONNECT_DELAY_MS = 3000;

/**
 * Fase B (EXPERIMENTAL): frame de input observado no DataChannel, capturado ao vivo (ver
 * BONK_PROTOCOL.md — "Sincronização de partida"). É um mapa MessagePack de 3 chaves —
 * `{ i: <uint8>, f: <uint16>, c: <uint8> }`:
 *   i — bitmask de teclas pressionadas (ver `keys()` em score/simSandbox.ts)
 *   f — tick a ~30Hz, big-endian
 *   c — contador sequencial da mensagem
 *
 * CORREÇÃO (confirmada contra um client real via console do navegador — a versão anterior
 * derrubava o client com `BinaryPackFailure` em TODO frame recebido): a captura original leu o
 * prefixo `0xb1` como "marcador fixo", mas em MessagePack real `0xa0-0xbf` é o header de string
 * curta (`fixstr`) cujos 5 bits baixos codificam o TAMANHO da string — `0xb1` = 0xb1-0xa0 = 17
 * bytes, não um marcador. Pra uma chave de 1 char ("i"/"f"/"c") o header correto é `0xa1`
 * (fixstr de 1 byte). Os valores de `i` e `c` também precisam do tag `0xcc` (uint8) — sem ele,
 * um valor >= 0x80 vira outro tipo MessagePack inteiramente (fixmap/fixarray/fixstr), não um
 * inteiro positivo.
 */
function buildInputFrame(iValue: number, tick: number, seq: number): Buffer {
  return Buffer.from([
    0x83, 0xa1, 0x69, 0xcc, iValue & 0xff,
    0xa1, 0x66, 0xcd, (tick >> 8) & 0xff, tick & 0xff,
    0xa1, 0x63, 0xcc, seq & 0xff,
  ]);
}

/** Gera um token de sessão no mesmo formato do client PeerJS oficial (~11 chars base36). */
function generateToken(): string {
  return Math.random().toString(36).slice(2);
}

interface OfferPayload {
  sdp: { sdp: string; type: 'offer' };
  type: 'data';
  connectionId: string;
  browser?: string;
  label?: string;
  reliable?: boolean;
  serialization?: string;
}

interface CandidatePayload {
  candidate: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null; usernameFragment?: string | null };
  type: 'data';
  connectionId: string;
}

type BrokerMessage =
  | { type: 'OPEN' }
  | { type: 'OFFER'; src: string; dst: string; payload: OfferPayload }
  | { type: 'ANSWER'; src: string; dst: string; payload: { sdp: { sdp: string; type: 'answer' }; type: 'data'; connectionId: string } }
  | { type: 'CANDIDATE'; src: string; dst: string; payload: CandidatePayload }
  | { type: 'EXPIRE'; src: string; dst: string }
  | { type: 'HEARTBEAT' }
  | { type: string; [key: string]: unknown };

interface PeerConnEntry {
  pc: RTCPeerConnection;
  connectionId: string;
  channel: RTCDataChannel | null;
  /** Fecha a conexão se ela continuar "disconnected" (sem se recuperar) por DISCONNECTED_GRACE_MS. */
  disconnectTimer: NodeJS.Timeout | null;
}

/** Quanto uma conexão pode ficar "disconnected" (queda de rede momentânea) antes de ser fechada. */
const DISCONNECTED_GRACE_MS = 30_000;

/** Endereço de rede de um peer visto no handshake WebRTC (só leitura; não é usado pelo protocolo). */
export interface PeerNetworkInfo {
  /** peerID do jogador (o mesmo do pacote de entrada). */
  src: string;
  /** De onde veio: linha `a=candidate` do OFFER, mensagem CANDIDATE, ou o par ICE ESCOLHIDO (o endereço real da conexão). */
  origin: 'offer' | 'candidate' | 'selected';
  /** IP (ou nome mDNS `xxxx.local` quando o navegador o oculta). */
  address: string;
  port: number;
  /** host | srflx | prflx | relay */
  type: string;
  protocol: string;
}

/** Lê uma linha ICE (`candidate:1 1 udp 2122 1.2.3.4 5000 typ srflx ...`); null se malformada. */
export function parseIceCandidate(line: string): Omit<PeerNetworkInfo, 'src' | 'origin'> | null {
  const m = /candidate:\S+\s+\d+\s+(\S+)\s+\d+\s+(\S+)\s+(\d+)\s+typ\s+(\w+)/i.exec(line);
  if (!m) return null;
  return { protocol: m[1]!.toLowerCase(), address: m[2]!, port: Number(m[3]), type: m[4]!.toLowerCase() };
}

export interface PeerBrokerClientEvents {
  /** Endereço de rede de um peer visto no handshake (candidatos e o par ICE escolhido). */
  network: [info: PeerNetworkInfo];
  open: [];
  error: [Error];
  close: [];
  /** Mensagem crua recebida de um peer pelo DataChannel (frames de input/física). */
  message: [src: string, data: Buffer];
}

/**
 * Um `PeerBrokerClient` por sala — usa o mesmo `peerID` já enviado em CREATE_ROOM/
 * JOIN_ROOM (`AuthClient.generatePeerID()`), então outros peers já sabem pra quem
 * endereçar o OFFER assim que recebem o roster via PLAYER_JOIN/ROOM_JOIN.
 */
export class PeerBrokerClient extends EventEmitter<PeerBrokerClientEvents> {
  private ws: WebSocket | null = null;
  private readonly connections = new Map<string, PeerConnEntry>(); // key = src peerID
  // Fase C: última mensagem crua recebida de cada peer, pra retransmitir pra
  // quem conectar depois (ver `relayLastKnownState`).
  private readonly lastMessage = new Map<string, Buffer>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private closed = false;

  constructor(
    private readonly server: string,
    private readonly peerID: string,
    private readonly logger: Logger,
  ) {
    super();
  }

  connect(): void {
    if (this.closed) return;
    const token = generateToken();
    const url = `wss://${this.server}.bonk.io/myapp/peerjs?key=peerjs&id=${this.peerID}&token=${token}`;
    const ws = new WebSocket(url, { rejectUnauthorized: false });
    this.ws = ws;

    ws.on('open', () => {
      this.startHeartbeat();
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      let msg: BrokerMessage;
      try {
        msg = JSON.parse(raw.toString()) as BrokerMessage;
      } catch {
        this.logger.warn({ raw: raw.toString().slice(0, 200) }, '[peer-broker] mensagem não-JSON ignorada');
        return;
      }
      void this.handleMessage(msg);
    });

    ws.on('close', () => {
      this.stopHeartbeat();
      this.emit('close');
      if (!this.closed) {
        setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
      }
    });

    ws.on('error', (err: Error) => {
      this.logger.warn({ err: err.message }, '[peer-broker] erro no socket do broker');
      this.emit('error', err);
    });
  }

  /**
   * Manda um frame de input (Fase B, ver `buildInputFrame`) pra TODOS os peers com DataChannel
   * aberto — é como o bot transmite o próprio movimento (não confirmado em produção; só o frame de
   * bootstrap com `i=0` já foi validado). Um canal com problema não pode derrubar os outros.
   */
  sendInput(iValue: number, frame: number, seq: number): void {
    const buf = buildInputFrame(iValue, frame, seq);
    for (const [src, { channel }] of this.connections) {
      if (channel?.readyState !== 'open') continue;
      try {
        channel.send(buf);
      } catch (err) {
        this.logger.warn({ src, err: (err as Error).message }, '[peer-broker] falha enviando frame de input');
      }
    }
  }

  /**
   * Fecha a conexão P2P de um peer que SAIU (ou cuja conexão falhou) e esquece a última mensagem dele.
   *
   * Sem isso, cada jogador que entrava e saía deixava uma RTCPeerConnection do werift VIVA para sempre (consentimento
   * ICE, retransmissões DTLS/SCTP e os eventos internos rodando): numa sala com muita rotatividade a CPU crescia sem
   * parar até 100% — ping alto, jogadores "voando", conexão com o bonk.io caindo (perfil da sala da IA, 25/09/2026:
   * o sistema de eventos do werift no topo). A última mensagem do peer também deixava de ser repassada a quem entrava.
   */
  closePeer(src: string): void {
    const entry = this.connections.get(src);
    if (entry) {
      this.connections.delete(src);
      this.closeEntry(entry);
    }
    this.lastMessage.delete(src);
  }

  /** Quantas conexões P2P estão abertas (diagnóstico / testes). */
  get peerCount(): number {
    return this.connections.size;
  }

  private closeEntry(entry: PeerConnEntry): void {
    if (entry.disconnectTimer) clearTimeout(entry.disconnectTimer);
    entry.disconnectTimer = null;
    try {
      void entry.pc.close();
    } catch (err) {
      this.logger.debug({ err: (err as Error).message }, '[peer-broker] erro fechando conexão');
    }
  }

  disconnect(): void {
    this.closed = true;
    this.stopHeartbeat();
    for (const entry of this.connections.values()) {
      this.closeEntry(entry);
    }
    this.connections.clear();
    this.lastMessage.clear();
    this.ws?.close();
    this.ws = null;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'HEARTBEAT' });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private async handleMessage(msg: BrokerMessage): Promise<void> {
    switch (msg.type) {
      case 'OPEN':
        this.emit('open');
        break;

      case 'OFFER':
        await this.handleOffer(msg as Extract<BrokerMessage, { type: 'OFFER' }>);
        break;

      case 'CANDIDATE':
        this.handleCandidate(msg as Extract<BrokerMessage, { type: 'CANDIDATE' }>);
        break;

      case 'EXPIRE':
        // Não deveria mais acontecer do nosso lado depois deste fix — pode acontecer
        // se o peer remoto sair antes do handshake completar (condição normal).
        this.logger.debug({ src: (msg as { src?: string }).src }, '[peer-broker] EXPIRE recebido');
        break;

      default:
        // HEARTBEAT (eco do servidor, se houver) ou tipos não mapeados — sem ação.
        break;
    }
  }

  private async handleOffer(msg: Extract<BrokerMessage, { type: 'OFFER' }>): Promise<void> {
    const { src, payload } = msg;
    for (const line of payload.sdp.sdp.split(/\r?\n/)) {
      if (!line.startsWith('a=candidate:')) continue;
      const c = parseIceCandidate(line.slice(2));
      if (c) this.safeEmitNetwork({ src, origin: 'offer', ...c });
    }
    const existing = this.connections.get(src);
    if (existing) {
      this.connections.delete(src);
      this.closeEntry(existing);
    }

    const pc = new RTCPeerConnection();
    const entry: PeerConnEntry = { pc, connectionId: payload.connectionId, channel: null, disconnectTimer: null };
    this.connections.set(src, entry);

    // Conexão que falhou/fechou do outro lado (ou que caiu e não voltou) é fechada daqui também. Só mexe na conexão se
    // ela ainda for a ATUAL deste peer (um OFFER novo pode já ter trocado a entrada).
    try {
      pc.connectionStateChange?.subscribe((state) => {
        if (this.connections.get(src) !== entry) return;
        if (state === 'failed' || state === 'closed') {
          this.logger.debug({ src, state }, '[peer-broker] conexão encerrada; liberando');
          this.closePeer(src);
        } else if (state === 'disconnected') {
          entry.disconnectTimer ??= setTimeout(() => {
            if (this.connections.get(src) === entry && pc.connectionState === 'disconnected') this.closePeer(src);
          }, DISCONNECTED_GRACE_MS);
          entry.disconnectTimer.unref?.();
        } else if (entry.disconnectTimer) {
          clearTimeout(entry.disconnectTimer);
          entry.disconnectTimer = null;
        }
      });
    } catch (err) {
      this.logger.debug({ src, err: (err as Error).message }, '[peer-broker] não foi possível acompanhar o estado da conexão');
    }

    // Só observação (moderação): NUNCA pode atrapalhar o handshake, então qualquer falha aqui é engolida.
    try {
      pc.connectionStateChange?.subscribe((state) => {
        if (state !== 'connected') return;
        try {
          const rc = pc.iceTransports[0]?.connection.nominated?.remoteCandidate;
          if (rc) this.safeEmitNetwork({ src, origin: 'selected', address: rc.host, port: rc.port, type: rc.type, protocol: rc.transport });
        } catch (err) {
          this.logger.debug({ src, err: (err as Error).message }, '[peer-broker] par ICE indisponível');
        }
      });
    } catch (err) {
      this.logger.debug({ src, err: (err as Error).message }, '[peer-broker] não foi possível observar o estado da conexão');
    }

    pc.onicecandidate = (event) => {
      const candidate = event.candidate;
      if (!candidate) return;
      this.send({
        type: 'CANDIDATE',
        dst: src,
        payload: {
          candidate: {
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
          },
          type: 'data',
          connectionId: payload.connectionId,
        },
      });
    };

    pc.ondatachannel = (event) => {
      this.logger.debug({ src }, '[peer-broker] data channel aberto');
      const channel = event.channel;
      entry.channel = channel;

      // Fase C: cacheia a última mensagem crua recebida deste peer — é o que
      // permite retransmitir o estado mais recente pra quem conectar depois,
      // sem precisar entender o formato de física de verdade.
      channel.onmessage = (msgEvent) => {
        const data = typeof msgEvent.data === 'string' ? Buffer.from(msgEvent.data) : msgEvent.data;
        this.lastMessage.set(src, data);
        this.emit('message', src, data);
      };

      const sendBootstrap = (): void => {
        try {
          channel.send(buildInputFrame(0, Date.now() & 0xffff, 0));
          this.logger.debug({ src }, '[peer-broker] frame de bootstrap (Fase B experimental) enviado');
        } catch (err) {
          this.logger.warn({ src, err: (err as Error).message }, '[peer-broker] falha enviando frame de bootstrap');
        }
        this.relayLastKnownState(src, channel);
      };
      if (channel.readyState === 'open') {
        sendBootstrap();
      } else {
        channel.onopen = sendBootstrap;
      }
    };

    try {
      await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp.sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.send({
        type: 'ANSWER',
        dst: src,
        payload: {
          sdp: { sdp: pc.localDescription!.sdp, type: 'answer' },
          type: 'data',
          connectionId: payload.connectionId,
        },
      });
    } catch (err) {
      this.logger.warn({ src, err: (err as Error).message }, '[peer-broker] falha respondendo OFFER');
      if (this.connections.get(src) === entry) this.closePeer(src);
    }
  }

  /**
   * Fase C (EXPERIMENTAL): retransmite pro peer recém-conectado (`newSrc`) a última
   * mensagem crua que recebemos de CADA outro peer já conectado — sem decodificar
   * nada. Hipótese: um espectador que entra depois de uma partida já ativa fica
   * preso em "awaiting first data" (ver BONK_PROTOCOL.md, Pitfall 10) porque nunca
   * recebe física de ninguém; o host, por já estar conectado a todo mundo via
   * malha completa, pode servir de "cache" e entregar um retrato do estado mais
   * recente sem precisar reiniciar a partida pra todo mundo (alternativa ao
   * restart forçado no PickController).
   */
  private relayLastKnownState(newSrc: string, newChannel: RTCDataChannel): void {
    for (const [otherSrc, buf] of this.lastMessage) {
      if (otherSrc === newSrc) continue;
      try {
        newChannel.send(buf);
        this.logger.debug(
          { newSrc, fromSrc: otherSrc, bytes: buf.length },
          '[peer-broker] estado retransmitido (Fase C experimental)',
        );
      } catch (err) {
        this.logger.warn({ newSrc, fromSrc: otherSrc, err: (err as Error).message }, '[peer-broker] falha retransmitindo estado');
      }
    }
  }

  /** Um ouvinte de `network` com defeito não pode derrubar o handshake. */
  private safeEmitNetwork(info: PeerNetworkInfo): void {
    try {
      this.emit('network', info);
    } catch (err) {
      this.logger.warn({ err: (err as Error).message }, '[peer-broker] ouvinte de network falhou');
    }
  }

  private handleCandidate(msg: Extract<BrokerMessage, { type: 'CANDIDATE' }>): void {
    const entry = this.connections.get(msg.src);
    if (!entry) return;
    const c = msg.payload.candidate;
    const parsed = parseIceCandidate(c.candidate);
    if (parsed) this.safeEmitNetwork({ src: msg.src, origin: 'candidate', ...parsed });
    void entry.pc.addIceCandidate({
      candidate: c.candidate,
      sdpMid: c.sdpMid ?? undefined,
      sdpMLineIndex: c.sdpMLineIndex ?? undefined,
    });
  }
}
