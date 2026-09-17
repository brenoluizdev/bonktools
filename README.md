# bonktools

[![npm version](https://img.shields.io/npm/v/bonktools.svg)](https://www.npmjs.com/package/bonktools)
[![CI](https://github.com/brenoluizdev/bonktools/actions/workflows/ci.yml/badge.svg)](https://github.com/brenoluizdev/bonktools/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20.18.1-brightgreen)](https://nodejs.org)

Cliente TypeScript **headless** para [bonk.io](https://bonk.io) — conecta direto via Socket.IO, sem browser. Crie e gerencie salas, entre em salas existentes, escute o roster e os eventos de partida em tempo real, e rode bots 24h com reconexão automática.

**Por que headless?** Automatizar o bonk.io com Puppeteer/Playwright exige um browser completo (~300 MB de RAM, headless instável, tela virtual no Linux). `bonktools` fala o protocolo Socket.IO do jogo diretamente — **menos de 15 MB de RAM por sala**, sem Chromium, sem Xvfb, sem depender de seletores de UI que quebram a cada atualização do client.

---

## Índice

- [Arquitetura em camadas](#arquitetura-em-camadas)
- [Instalação](#instalação)
- [Autenticação](#autenticação)
- [Criando uma sala — `createRoom()`](#criando-uma-sala--createroom)
- [Entrando em uma sala — `joinRoom()`](#entrando-em-uma-sala--joinroom)
- [`BonkRoom` — eventos e métodos](#bonkroom--eventos-e-métodos)
- [Reconexão automática](#reconexão-automática)
- [`BonkSession` — pool de salas](#bonksession--pool-de-salas)
- [Tratamento de erros](#tratamento-de-erros)
- [Decisões técnicas](#decisões-técnicas)
- [Notas de segurança](#notas-de-segurança)
- [Disclaimer](#disclaimer)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

---

## Arquitetura em camadas

```
BonkSession
  └── BonkRoom  (1 por sala)
        └── BonkTransport  (socket.io-client v2)
              └── bonk.io WS
```

| Camada | Responsabilidade |
|---|---|
| `BonkTransport` | Conexão Socket.IO v2 (EIO=3), TLS Sectigo, timesync |
| `BonkRoom` | Ciclo de vida da sala, roster, eventos tipados, reconexão |
| `BonkSession` | Pool de salas, auth compartilhado, throttle, reconcile 60s |

---

## Instalação

```bash
npm install bonktools
# ou
pnpm add bonktools
# ou
yarn add bonktools
```

**Requisitos:** Node.js >= 20.18.1. O pacote usa ESM (`"type": "module"`), com build CJS disponível para `require()`.

---

## Autenticação

A lib suporta dois modos:

```ts
import type { AuthOptions } from 'bonktools';

// Conta registrada (recomendado para bots de longa duração)
const auth: AuthOptions = {
  type: 'registered',
  username: 'meu_usuario',
  password: 'minha_senha',
};

// Convidado (sem HTTP de auth)
const auth: AuthOptions = {
  type: 'guest',
  guestName: 'BonkBot',
};
```

Com `type: 'registered'`, a lib faz uma chamada HTTP para o endpoint de login do bonk.io e obtém um token de sessão. O token é reusado em todas as salas da mesma `BonkSession`.

---

## Criando uma sala — `createRoom()`

A função mais direta. Retorna um `BonkRoom` já conectado e ativo (aguarda o packet `SHARE_LINK` do servidor antes de resolver).

```ts
import { createRoom } from 'bonktools';

const room = await createRoom({
  auth: { type: 'registered', username: '...', password: '...' },
  desiredState: {
    roomName: 'Minha Sala',
    password: '',         // string vazia = sem senha
    maxPlayers: 6,
    mode: 'b',            // 'b'=classic, 'ar'=arrows, 'ard'=arrows death, 'sp'=grapple, 'v'=vtol, 'f'=football
    rounds: 3,
  },
  hidden: false,          // aparece na lista pública
  timeoutMs: 10_000,      // rejeita com RoomCreationTimeoutError se demorar mais
});

console.log('Link da sala:', room.shareLink);
// => https://bonk.io/123456abcde
```

### Opções de `createRoom()`

| Campo | Tipo | Default | Descrição |
|---|---|---|---|
| `auth` | `AuthOptions` | — | Estratégia de autenticação (obrigatório) |
| `desiredState` | `DesiredRoomState` | — | Configuração da sala (obrigatório) |
| `hidden` | `boolean` | `false` | Sala oculta na lista pública |
| `minLevel` | `number` | `0` | Nível mínimo para entrar |
| `maxLevel` | `number` | `999` | Nível máximo para entrar |
| `timeoutMs` | `number` | `10000` | Timeout em ms para receber SHARE_LINK |
| `protocolVersion` | `number` | `49` | Versão do protocolo bonk.io |
| `reconnectPolicy` | `ReconnectPolicyOptions` | defaults | Política de backoff |

### `DesiredRoomState`

```ts
interface DesiredRoomState {
  roomName: string;
  password: string;       // '' = sem senha
  maxPlayers: number;     // 1–8
  mode: string | number;  // 'b', 'ar', 'ard', 'sp', 'v', 'f'...
  engine?: string;        // 'b', 'f'...
  rounds: number;
  map?: string | null;    // blob LZ-String do mapa
}
```

---

## Entrando em uma sala — `joinRoom()`

```ts
import { joinRoom } from 'bonktools';

// Via URL pública
const room = await joinRoom('https://bonk.io/123456abcde', {
  auth: { type: 'registered', username: '...', password: '...' },
  role: 'host',       // 'host' (time=1) ou 'spectator' (time=0, apenas o time inicial requisitado)
  password: '',       // senha da sala, se houver
});
```

A lib parseia a URL, resolve o servidor e depois conecta. Resolve após o packet `ROOM_JOIN`, ou rejeita com `RoomJoinTimeoutError`.

Também aceita um `ResolvedRoomAddress` já pronto (sem chamada HTTP):

```ts
const room = await joinRoom(
  { server: 'b2seattle1', joinId: '...', bypass: 'abcde' },
  { auth, role: 'spectator' },
);
```

> **Nota:** `role: 'spectator'` define apenas o time inicial requisitado no `JOIN_ROOM` (mesmo comportamento do botão "Spectate" do client oficial) — o servidor ainda trata a conexão como um jogador normal daí em diante. Qualquer lógica de sala que decide quem joga (pick systems, etc.) precisa lidar com isso explicitamente.

---

## `BonkRoom` — eventos e métodos

`BonkRoom` estende `EventEmitter3<BonkRoomEvents>`. Todos os eventos são tipados.

### Estado atual da sala

```ts
const state = room.state;
// state.myId        — ID numérico do bot nesta sala (null antes de entrar)
// state.hostId      — ID numérico do host atual
// state.players     — Map<id, PlayerData>
// state.inGame      — boolean (partida em andamento)
// state.teamsLocked — boolean

room.currentMap; // blob LZ-String do mapa ativo, ou null (mapa padrão)
```

### Eventos principais

```ts
// Jogador entrou
room.on('player-join', (packet) => {
  console.log(packet.userName, packet.id, packet.level);
});

// Jogador saiu
room.on('player-leave', (packet) => {
  console.log('saiu id:', packet.id);
});

// Mensagem de chat (filtra echo do próprio bot automaticamente)
room.on('chat-message', (packet) => {
  const nome = room.state.players.get(packet.id)?.userName;
  console.log(`[${nome}]: ${packet.message}`);
});

// Link da sala disponível
room.on('share-link', (packet) => {
  console.log(`https://bonk.io/${packet.roomId}${packet.bypass}`);
});

// Sala morreu (socket caiu, ban, sala cheia, retries esgotados)
room.on('room-dead', (reason) => {
  // reason.kind: 'socket-disconnect' | 'status-banned' | 'status-room_full' | 'max-retries-exceeded'
});

// Sala foi recriada após reconexão
room.on('room-rebuilt', (shareLink) => {
  console.log('nova URL:', shareLink);
});

// Todos os packets brutos (antes dos reducers)
room.on('raw-packet', (packet) => {
  if (packet.type === 'UNKNOWN') { /* packet não mapeado */ }
});
```

### Tabela completa de eventos

| Evento | Payload | Descrição |
|---|---|---|
| `room-join` | `RoomJoinPacket` | Bot entrou na sala |
| `room-created` | `RoomCreatedPacket` | Bot criou a sala |
| `player-join` | `PlayerJoinPacket` | Jogador entrou |
| `player-leave` | `PlayerLeavePacket` | Jogador saiu |
| `host-leave` | `HostLeavePacket` | Host saiu (newHostId=-1 = sala fechada) |
| `team-change` | `TeamChangePacket` | Jogador trocou de time |
| `ready-change` | `ReadyChangePacket` | Jogador marcou/desmarcou pronto |
| `tabbed` | `TabbedPacket` | Jogador tabou/voltou |
| `username-change` | `UsernameChangePacket` | Jogador mudou de nome |
| `player-pings` | `PlayerPingsPacket` | Ping de todos os jogadores |
| `game-start` | `GameStartPacket` | Partida iniciada |
| `game-end` | `GameEndPacket` | Partida encerrada |
| `all-ready-reset` | `AllReadyResetPacket` | Reset de estado pronto |
| `chat-message` | `ChatMessagePacket` | Mensagem de chat |
| `player-kick` | `PlayerKickPacket` | Jogador foi kickado |
| `countdown` | `CountdownPacket` | Countdown iniciado |
| `abort-countdown` | `AbortCountdownPacket` | Countdown abortado |
| `teamlock-toggle` | `TeamlockTogglePacket` | Times bloqueados/desbloqueados |
| `gamemode-change` | `GamemodeChangePacket` | Modo de jogo alterado |
| `change-rounds` | `ChangeRoundsPacket` | Número de rounds alterado |
| `map-switch` | `MapSwitchPacket` | Mapa trocado |
| `balance-set` | `BalanceSetPacket` | Balance de jogador alterado |
| `player-level-up` | `PlayerLevelUpPacket` | Jogador subiu de nível |
| `room-name-update` | `RoomNameUpdatePacket` | Nome da sala alterado |
| `room-password-update` | `RoomPasswordUpdatePacket` | Senha da sala alterada |
| `status-message` | `StatusMessagePacket` | Mensagem de status do servidor |
| `share-link` | `ShareLinkPacket` | Link da sala disponível |
| `room-dead` | `RoomDeadReason` | Sala morreu |
| `room-rebuilt` | `string` (shareLink) | Sala reconectada |
| `raw-packet` | `IncomingPacket \| UnknownPacket` | Todo packet bruto |

### Métodos de ação

#### Sala

```ts
room.setRoomName('Novo Nome');
room.setRoomPassword('nova_senha');  // '' = remover senha
```

#### Jogo

```ts
room.startGame();
room.stopGame();           // volta ao lobby
room.startCountdown(3);    // countdown de 3s
room.abortCountdown();

room.setMode('b', 'b');    // engine, mode
room.setRounds(5);
room.setMap(lzStringBlob); // troca o mapa ativo
```

#### Moderação

```ts
room.chat('Olá!');
room.kickPlayer(id);       // kick sem ban
room.banPlayer(id);        // ban permanente
```

#### Times e host

```ts
// time: 0=spec 1=ffa 2=red 3=blue 4=green 5=yellow
room.setTeam(id, 2);
room.setTeamLock(true);
room.setTeamsEnabled(true);
room.giveHost(id);
room.setNoHostSwap(true);  // desativa troca automática de host
```

#### Desconectar

```ts
room.disconnect();  // idempotente, limpa timers e estado
```

---

## Reconexão automática

`BonkRoom` reconecta automaticamente após desconexões transitórias (socket caiu, servidor reiniciou). A política de backoff é configurável:

```ts
const room = await createRoom({
  auth,
  desiredState: { /* ... */ },
  reconnectPolicy: {
    maxAttempts: 10,       // default
    initialDelayMs: 1000,  // default: 1s
    maxDelayMs: 30_000,    // default: 30s
    multiplier: 1.5,       // default
    jitter: true,          // full jitter (recomendado)
  },
});
```

Causas **terminais** (sem retry): `status-banned`, `status-room_full`, `max-retries-exceeded`.
Causas **transitórias** (com retry): `socket-disconnect`.

---

## `BonkSession` — pool de salas

Para rodar múltiplas salas com a mesma conta, use `BonkSession`. Ela compartilha o `AuthClient`, o token e aplica throttle de token-bucket entre criações.

```ts
import { BonkSession } from 'bonktools';

const session = new BonkSession({
  auth: { type: 'registered', username: '...', password: '...' },
  throttle: {
    capacity: 3,       // burst máximo de criações simultâneas
    refillPerSec: 0.5, // 1 slot reabastecido a cada 2s
  },
});

// Pré-autentica uma vez; token reusado em todas as salas
await session.getToken();

// Ouve eventos do pool
session.on('room-added', (localId) => {
  const { room } = session.rooms.get(localId)!;
  console.log('sala ativa:', room.shareLink);
});

session.on('room-dead-terminal', ({ localId, reason }) => {
  console.error('sala terminal:', localId, reason);
});
```

### `startFromConfig()` — modo declarativo

Cria todas as salas a partir de um array de configs, com stagger + jitter entre criações. Registra as configs no reconcile loop de 60s (rede de segurança para falhas silenciosas).

```ts
await session.startFromConfig({
  rooms: [
    { id: 'sala-1', name: 'ATLAS', maxPlayers: 6, mode: 'b', rounds: 3 },
    { id: 'sala-2', name: 'ZEUS',  maxPlayers: 8, mode: 'ar', rounds: 5 },
  ],
  throttle: {
    maxConcurrentRooms: 10,
    roomCreationDelayMs: 3000,   // espera mínima entre criações
    roomCreationJitterMs: 2000,  // + aleatório de até 2s
  },
});
```

### `addRoom()` / `removeRoom()` — modo imperativo

```ts
// Adicionar sala avulsa
const localId = await session.addRoom({
  id: 'sala-3',
  name: 'HERMES',
  password: 'segredo',
  maxPlayers: 4,
  mode: 'sp',
  rounds: 3,
});

// Acessar a BonkRoom diretamente
const { room, status } = session.rooms.get(localId)!;
room.chat('Olá!');

// Remover sala
await session.removeRoom(localId);

// Encerrar toda a sessão (idempotente)
await session.destroy();
```

### `RoomConfig`

```ts
interface RoomConfig {
  id: string;          // identificador único (usado no reconcile)
  name: string;
  password?: string;   // default: ''
  maxPlayers?: number; // default: 6
  mode?: string;       // default: 'b'
  rounds?: number;     // default: 3
  hidden?: boolean;    // default: false
  map?: string;        // blob LZ-String
}
```

### Status de uma sala no pool

| Status | Significado |
|---|---|
| `starting` | `createRoom()` ainda não resolveu |
| `active` | sala criada e viva |
| `dead-transient` | morta — será recriada com throttle |
| `dead-terminal` | morta permanentemente (ban, sala cheia, retries esgotados) |

---

## Tratamento de erros

```ts
import { RoomCreationTimeoutError, RoomJoinTimeoutError } from 'bonktools';

try {
  const room = await createRoom({ auth, desiredState: { /* ... */ } });
} catch (err) {
  if (err instanceof RoomCreationTimeoutError) {
    // SHARE_LINK não chegou dentro do timeout
  }
}

try {
  const room = await joinRoom('https://bonk.io/...', { auth });
} catch (err) {
  if (err instanceof RoomJoinTimeoutError) {
    // ROOM_JOIN não chegou dentro do timeout (ex: sala cheia)
  }
}
```

---

## Decisões técnicas

**Por que `socket.io-client@2` e não a versão mais recente?**
O servidor bonk.io fala o protocolo Engine.IO 3 (`EIO=3`). O cliente v4 negocia `EIO=4` e não tem opção de downgrade — a conexão falha imediatamente no handshake. A versão 2.5.0 é a última da linha v2 e a única compatível.

**Por que `undici` e não `fetch` nativo?**
O bonk.io serve uma cadeia TLS Sectigo incompleta. O `fetch` nativo do Node.js não permite injetar uma CA customizada por requisição sem monkeypatch global. O `undici.Agent` permite configurar a CA Sectigo por cliente, sem afetar outras requisições HTTPS do processo.

**Por que o CA Sectigo está bundlado?**
Usar o TLS store padrão do Node.js rejeitaria a cadeia incompleta do bonk.io. Ao invés de desativar toda a verificação TLS globalmente (`NODE_TLS_REJECT_UNAUTHORIZED=0`), o projeto bundla a cadeia completa Sectigo e injeta apenas onde necessário.

**Por que `EventEmitter3` e não o `EventEmitter` nativo?**
EventEmitter3 tem tipagem genérica por evento (`EventEmitter<Events>`), o que permite `room.on('player-join', handler)` com o tipo do `handler` inferido corretamente pelo TypeScript.

---

## Notas de segurança

- Credenciais (`username`, `password`) **nunca são logadas** — apenas eventos de sucesso/falha.
- O token de sessão **nunca aparece em logs**.
- TLS usa cadeia Sectigo customizada via `undici.Agent` — sem `NODE_TLS_REJECT_UNAUTHORIZED=0` global.
- Variáveis de ambiente são lidas via `process.env` — nunca hardcode credenciais no código.

---

## Disclaimer

`bonktools` é um cliente não-oficial, resultado de engenharia reversa do protocolo Socket.IO público do bonk.io. Não é afiliado, endossado ou mantido pela equipe do bonk.io. Use por sua conta e risco, respeitando os termos de serviço do jogo — o projeto existe para automação, bots e ferramentas legítimas (salas 24h, moderação, integração com outras plataformas), não para lag/DDoS, spam ou qualquer forma de abuso.

---

## Contribuindo

Veja [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Licença

[MIT](./LICENSE)
