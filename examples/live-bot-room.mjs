// Sala de teste ao vivo: sobe uma sala real de football no bonk.io (conta registrada — na primeira
// tentativa usamos convidado e nem o roster apareceu no lobby de ninguém, então agora exige a mesma
// conta registrada que a BonkTools-Room usa em produção), espera um jogador de verdade entrar, monta
// os times, inicia a partida e o bot passa a transmitir o próprio movimento via WebRTC
// (`room.sendInput`, ver BonkRoom.ts) num padrão fixo e bem visível.
//
// EXPERIMENTAL: só serve pra descobrir se o formato do frame de input (reverso-engenheirado, nunca
// confirmado além do frame de bootstrap estático) realmente move o avatar do bot na tela de quem
// entrar. Não é o modelo de RL treinado — é um padrão fixo só pra validar o mecanismo.
//
// Rodar depois de `pnpm build` (importa de dist/, sem precisar de um runner de TypeScript). Mesma
// convenção de `src/cli/capture-is.ts`: credenciais via variável de ambiente, nunca hardcoded.
//   BONK_USERNAME=... BONK_PASSWORD=... node examples/live-bot-room.mjs
import { createRoom, ScoreTracker, TEAM_BLUE, TEAM_RED } from '../dist/index.js';

const username = process.env.BONK_USERNAME;
const password = process.env.BONK_PASSWORD;
if (!username || !password) {
  process.stderr.write('Erro: defina BONK_USERNAME e BONK_PASSWORD como variáveis de ambiente.\n');
  process.stderr.write('Exemplo: BONK_USERNAME=myuser BONK_PASSWORD=mypass node examples/live-bot-room.mjs\n');
  process.exit(1);
}

// Bitmask de keys(i) em src/score/simSandbox.ts: left=1, right=2, up=4, down=8, action=16, action2=32.
// bonk.io é mapa 2D livre (sem "chão", tipo table ball) — up/down são direções de movimento normais,
// não pulo/agachar. Padrão testa as 4 direções em sequência, uma de cada vez.
const RIGHT = 2;
const UP = 4;
const LEFT = 1;
const DOWN = 8;
const IDLE = 0;

const PATTERN = [
  { bits: RIGHT, ms: 800 },
  { bits: IDLE, ms: 200 },
  { bits: UP, ms: 800 },
  { bits: IDLE, ms: 200 },
  { bits: LEFT, ms: 800 },
  { bits: IDLE, ms: 200 },
  { bits: DOWN, ms: 800 },
  { bits: IDLE, ms: 200 },
];

// Capturado de um GAME_START real (client oficial, football) via capture-full-gamestart.mjs — a UI
// do football não mostra preview de mapa, mas o TRIGGER_START real SEMPRE manda um `gs.map` de
// verdade. Nosso bot mandava `gs.map: ''` (desiredState.map nunca setado) — essa é a causa raiz de
// "trava no lobby sem erro nenhum": sem mapa, os clients não têm onde inicializar a física.
const FOOTBALL_MAP =
  'ILAcJAhBFBjBzCTlMiALgBgFoHV7zYC2AnAG4BGAEgHIA2CwAYgKoAaAagwHYp-IBhAFIB5JigCizEOODQQAd2ACQUiEJnBuAL0TIJAgGYj+ps+dTQAkgBk+aAFaYLKaAHESL0ywEClrgBF5LwgJSAAPPRCkcQAlfilnaOAA4A1kpAFoLIyAWUgKKL4sgSs8gqKUAIAFAHpTWoBqAGUqAHYOCWh0N3MFKgBrM0xIUDLo1IoVSUgiSsU3BXnU7AB7Uxhbe2AAQ3Bk6CpDDKQByAVgk7MciEhattrHp8f-Q0bn55J7j6elAFdoHRciBLsA1FRamQfo8oN9oQBmSHQ+oCACskBYSjQSD0b2R+whUOheOh4G0FBMfFSwDuD2hr3e0K+dJ+CgCjwGABY+MFCcjYSyPoiiT9gHVGgAVRDYqDBEk-AlI4mMhXASgANk8YKQvRpcNZIHlH2ZyKUtVwbHGoNgID50IFyOF-NyACZdFBMrbYm4OEQrBJsAAHACm7IluW0Eaj2ggtXVxATRGIDlq4cj6YjYJIoAATvZ5JBYEosgMbVdzLVufwBLV9lVU9Ho+Xmy2WwW5GEOxBxh7mDHgHQBABNNj0KxuIRkAAm01M+XSyUrphrdeQYcb6dbW+3Xnb0E7+9CIGl2BANhYbnCAAsp25sGRYERMPBchLzGF0FXokuGvGk--iAGAIAivL8d3AiD+D3A81DkRRtWAFgaWlItgFyaAiCYbRsGaSAAEsKHhaB4H9IQqDMVJmlBLxqkaMwoQaTAMwzfxILYrc1H3NAuNuEAyzYYFIAARg4P4KEw9A8Go5B8j+E5aiYjdcjNP9E2TBtmMzdjtLbGlJCPaZyI2YBsHVSDT07ZAOAlWA3CYeEKDOaBpLkNxg3mFsYG42C0JYeFIBvF1OXgABpNwaAfQZAwUJgZVQEyzMgnjUBoGy7IcvDgFWIcXRIBRg2aAZQvCyKBmitw4t40y2J4y5IEDNL7IoTLsty-LCuKiLYCiqwBCvBxCMgVEQpYSB4Bc9x3Mg0BuOQK8-ICqcgs60rA16-rBuG5ospyvKCqKsKuqi9wr3mNBqoggJ4EsiA+sajKdra-aVu6sr1oG-ytsevaOsO1aFDcU6UHOxKIOuyqBBIe7mu+9qDpK161r6j6hpC7bWp++Gjre5HNpC9tgHCAIR0gTApzYIQ6CsJhA0oIgODSMxxk4lJ2OgbBDDYW9t0OXVkDQKjl0eVd+EgIA';

const room = await createRoom({
  auth: { type: 'registered', username, password },
  desiredState: {
    roomName: 'BonkTools-RL — sala de teste',
    password: '',
    maxPlayers: 2,
    mode: 'b', // engine real vem depois via setMode() — ver comentário abaixo
    rounds: 3,
    map: FOOTBALL_MAP,
  },
  hidden: true, // só quem tiver o link entra
});

console.log('=== sala criada ===');
console.log('link:', room.shareLink);
console.log('meu id (bot):', room.state.myId);

// Mesma sequência de inicialização da BonkTools-Room em produção (PickController.onRoomReady,
// PickController.ts:255-263): `desiredState.mode` na CRIAÇÃO da sala não é o que liga a física de
// football — isso é `gs.ga`, setado via SEND_MODE (setMode), independente da criação. Sem isso a
// sala fica numa configuração inconsistente e o lobby não renderiza ninguém pra quem entra.
room.setTeamsEnabled(true);
room.setMode('f', 'f'); // engine, mode — 'f'/'f' = football (ver PickController.ts:20)
room.setRounds(3);
room.setReady(false);

console.log('\naguardando um jogador entrar...');

const score = new ScoreTracker(room);
score.on('error', (err) => console.warn('[score] rastreamento desativado:', err.message));
await score.start();

let movementTimer = null;

function stopMovement() {
  if (movementTimer) {
    clearTimeout(movementTimer);
    movementTimer = null;
  }
}

// O client real só manda um pacote de input QUANDO O ESTADO MUDA (aperta = 1 pacote, solta = 1
// pacote) — confirmado capturando o WebSocket de um jogador real: `42[4,{"i":2,...}]` uma vez ao
// apertar direita, `42[4,{"i":0,...}]` uma vez ao soltar, nada no meio enquanto segurava. Mandar o
// mesmo bit ~30x/s (como a versão anterior fazia) não é o que o protocolo espera — troquei pra
// mandar só na transição de cada fase do padrão, igual o client de verdade faz.
function startMovement() {
  stopMovement();
  let idx = 0;
  const sendNext = () => {
    const entry = PATTERN[idx];
    console.log(`[bot] input bits=${entry.bits}`);
    room.sendInput(entry.bits);
    idx = (idx + 1) % PATTERN.length;
    movementTimer = setTimeout(sendNext, entry.ms);
  };
  sendNext();
}

room.on('player-join', async (packet) => {
  const myId = room.state.myId;
  if (myId === null) {
    console.warn('room.state.myId ainda não definido — ignorando player-join');
    return;
  }
  console.log(`\n=== jogador entrou: ${packet.userName} (id ${packet.id}) ===`);
  console.log('montando times...');
  room.setTeam(myId, TEAM_BLUE);
  room.setTeam(packet.id, TEAM_RED);

  // pequena folga pra troca de time propagar antes de iniciar a partida.
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Indexado pelo ID real de cada um (sparse array) — NÃO por ordem de chegada. O host quase sempre
  // é id 0, então um array fixo tipo [null, bot, humano] colocaria o bot na posição errada (a posição
  // precisa ser igual ao id) e corrompe o mapeamento de corpos físicos do IS blob.
  const players = [];
  players[myId] = { id: myId, team: TEAM_BLUE };
  players[packet.id] = { id: packet.id, team: TEAM_RED };
  const is = await score.buildInitialState(players);
  if (!is) {
    console.warn('não consegui montar o IS blob — simulador de física ainda não está pronto?');
    return;
  }
  console.log('iniciando partida...');
  room.startGame({ is });
});

room.on('game-start', () => {
  console.log('\n=== partida começou — bot começando a se mexer ===');
  startMovement();
});

room.on('game-end', () => {
  console.log('\n=== partida terminou — bot parado ===');
  stopMovement();
});

room.on('room-dead', (reason) => {
  console.log('\n=== sala morreu:', reason.kind, '===');
  stopMovement();
  process.exit(0);
});

process.on('SIGINT', () => {
  stopMovement();
  room.disconnect();
  process.exit(0);
});
