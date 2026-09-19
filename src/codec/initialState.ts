import LZString from 'lz-string';
import PSON from 'pson';

/**
 * Codec do IS blob (`is` do TRIGGER_START / `state` do INFORM_IN_GAME).
 *
 * Formato (engenharia reversa do client, confirmado com round-trip byte a byte):
 *   PSON (dicionário estático) → base64 → LZString.compressToBase64
 *   → troca de maiúsc./minúsc. nos primeiros 101 caracteres.
 *
 * O estado guarda `players` e `discs` como arrays indexados pelo ID do jogador.
 * Um blob capturado numa sessão só funciona para os IDs daquela sessão;
 * `remapInitialStatePlayers` reescreve os IDs para os da sala atual.
 */

const PSON_KEYS: Array<string | number> = [
  'physics', 'shapes', 'fixtures', 'bodies', 'bro', 'joints', 'ppm', 'lights', 'spawns', 'lasers', 'capZones',
  'type', 'w', 'h', 'c', 'a', 'v', 'l', 's', 'sh', 'fr', 're', 'de', 'sn', 'fc', 'fm', 'f', 'd', 'n', 'bg',
  'lv', 'av', 'ld', 'ad', 'fr', 'bu', 'cf', 'rv', 'p', 'd', 'bf', 'ba', 'bb', 'aa', 'ab', 'axa', 'dr', 'em',
  'mmt', 'mms', 'ms', 'ut', 'lt', 'New body', 'Box Shape', 'Circle Shape', 'Polygon Shape', 'EdgeChain Shape',
  'priority', 'Light', 'Laser', 'Cap Zone', 'BG Shape', 'Background Layer', 'Rotate Joint', 'Slider Joint',
  'Rod Joint', 'Gear Joint', 65535, 16777215,
];

const pson = new PSON.StaticPair(PSON_KEYS);

/** Estado inicial decodificado (só os campos que o bonktools usa são tipados). */
export interface InitialState {
  players: Array<{ id: number; team: number; [k: string]: unknown } | null>;
  discs: Array<{ team: number; [k: string]: unknown } | null>;
  [k: string]: unknown;
}

function swapHead(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    out += i <= 100 ? (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()) : c;
  }
  return out;
}

export function decodeInitialState(is: string): InitialState {
  const b64 = LZString.decompressFromBase64(swapHead(is));
  if (!b64) throw new Error('IS blob inválido (LZ-String)');
  return pson.decode(Buffer.from(b64, 'base64')) as InitialState;
}

export function encodeInitialState(state: InitialState): string {
  const bytes = Buffer.from(pson.encode(state).toBuffer());
  return swapHead(LZString.compressToBase64(bytes.toString('base64')));
}

/**
 * Reescreve os IDs de jogador de um IS blob.
 *
 * @param is      blob capturado (jogadores nos slots 1..n, em ordem de corpo)
 * @param bal     `{ playerId: bodyIndex }` — o corpo `k` do blob passa a pertencer ao `playerId`
 *                (corpo 0 é o bot/host, sem disco)
 * @returns       blob com `players`/`discs` indexados pelos IDs reais; o original se não der para remapear
 */
export function remapInitialStatePlayers(is: string, bal: Record<number, number>): string {
  let state: InitialState;
  try {
    state = decodeInitialState(is);
  } catch {
    return is;
  }
  if (!Array.isArray(state.players) || !Array.isArray(state.discs)) return is;

  const players: InitialState['players'] = [];
  const discs: InitialState['discs'] = [];
  for (const [idStr, body] of Object.entries(bal)) {
    const id = Number(idStr);
    if (body < 1) continue;
    const p = state.players[body];
    const d = state.discs[body];
    if (!p || !d) return is; // blob não tem esse corpo: não arrisca
    players[id] = { ...p, id };
    discs[id] = { ...d };
  }
  for (let i = 0; i < Math.max(players.length, discs.length); i++) {
    players[i] ??= null;
    discs[i] ??= null;
  }
  state.players = players;
  state.discs = discs;
  return encodeInitialState(state);
}
