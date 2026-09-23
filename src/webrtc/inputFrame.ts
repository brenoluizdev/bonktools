/**
 * Frame de input que os navegadores trocam por WebRTC (DataChannel): um mapa MessagePack `{ i, f, c }` — o mesmo
 * input do pacote 7 do Socket.IO (`i` teclas, `f` quadro, `c` sequência), só que codificado em binário e com `f`/`c`
 * truncados (o client manda `f` em 16 bits e `c` em 8). Ver `buildInputFrame` em PeerBrokerClient.ts.
 *
 * Quando a conexão P2P com o host fecha, o navegador passa a mandar o input SÓ por aqui: quem precisa ver o
 * movimento dos jogadores (ScoreTracker) tem que ler este caminho também.
 */
export interface InputFrame {
  i: number;
  f: number;
  c: number;
}

/** Lê um frame de input; qualquer outra coisa (ou MessagePack malformado) devolve null. */
export function parseInputFrame(buf: Uint8Array): InputFrame | null {
  if (!buf || buf.length < 7) return null;
  const head = buf[0]!;
  if (head < 0x80 || head > 0x8f) return null; // fixmap
  const entries = head & 0x0f;
  let p = 1;
  const out: Partial<InputFrame> = {};
  const readUint = (): number | null => {
    if (p >= buf.length) return null;
    const b = buf[p++]!;
    if (b <= 0x7f) return b; // positive fixint
    if (b === 0xcc && p + 1 <= buf.length) return buf[p++]!;
    if (b === 0xcd && p + 2 <= buf.length) { const v = (buf[p]! << 8) | buf[p + 1]!; p += 2; return v; }
    if (b === 0xce && p + 4 <= buf.length) { const v = ((buf[p]! << 24) >>> 0) + ((buf[p + 1]! << 16) | (buf[p + 2]! << 8) | buf[p + 3]!); p += 4; return v; }
    return null;
  };
  for (let k = 0; k < entries; k++) {
    if (p + 2 > buf.length || buf[p] !== 0xa1) return null; // chave: fixstr de 1 caractere
    const key = String.fromCharCode(buf[p + 1]!);
    p += 2;
    const v = readUint();
    if (v === null) return null;
    if (key === 'i' || key === 'f' || key === 'c') out[key] = v;
  }
  if (p !== buf.length || typeof out.i !== 'number' || typeof out.f !== 'number') return null;
  return { i: out.i, f: out.f, c: out.c ?? 0 };
}
