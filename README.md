# BonkTools – Biblioteca para bots e salas Bonk.io

BonkTools é uma biblioteca para Node.js focada em automação de salas do [Bonk.io](https://bonk.io).

Ela combina duas partes principais:

- Bot WebSocket (baseado no projeto original `bonktools`), para conectar-se ao servidor do jogo.
- Criador de salas headless (Puppeteer/Playwright) que faz login, cria a sala e aplica configurações usando `sgrAPI`.

Esse pacote é pensado para quem quer:

- Criar salas Bonk.io programaticamente.
- Integrar bots com backends (rankings, filas, moderação).
- Manter um navegador “presente” sempre que o jogo exige ações do host.

---

## Instalação

```bash
npm install bonktools
```

O pacote já inclui os scripts necessários em `dependencies/`:

- `dependencies/CondensedInjector.js`
- `dependencies/sgrAPI.user.js`

Eles são carregados automaticamente pelo criador de salas.

---

## Requisitos

- Node.js 18 ou superior.
- Acesso à internet para abrir `https://bonk.io/`.
- Ambiente capaz de rodar Puppeteer/Playwright:
  - Linux, macOS ou Windows com Chrome/Chromium ou Firefox suportados.
- Uma conta Bonk.io para o bot:
  - Usuário e senha válidos.

---

## Configuração de ambiente

No seu projeto (não dentro de `node_modules`), crie um arquivo `.env` e defina:

```env
BOT_USERNAME=SeuUsuario
BOT_PASSWORD=SuaSenhaForteeee
```

Variáveis opcionais:

- `BROWSER=firefox`  
  Usa Playwright (Firefox) em vez de Chromium/Puppeteer para criar a sala.

Carregue o `.env` antes de usar a biblioteca:

```ts
import "dotenv/config";
```

---

## Uso rápido – Criar uma sala

O caminho mais simples é a função de alto nível `startRoom`, exportada pelo pacote.

```ts
import "dotenv/config";
import { startRoom } from "bonktools";

async function main() {
  const result = await startRoom({
    name: "Minha Sala Bonk",
    password: "",
    maxPlayers: 8,
    minLevel: 0,
    unlisted: false,
    mode: "f", // b | bs | ar | ard | sp | v | f
    rounds: 5,
    maps: [], // vazio = mapa padrão
    teams: true,
    favoriteIndex: 0, // posição nos favoritos (0 = 1º)
  });

  console.log("Sala criada em:", result.roomLink);
}

main().catch(console.error);
```

O retorno (`RoomCreationResult`) contém:

- `browser`: instância de `Browser` (Puppeteer ou Playwright).
- `page`: página usada para controlar o jogo.
- `roomLink`: link público da sala (`https://bonk.io/...`).
- `maps`: lista de mapas aplicada.

Lembre-se de fechar o navegador quando terminar:

```ts
await result.browser.close();
```

---

## API de alto nível

### `startRoom(params: RoomParameters): Promise<RoomCreationResult>`

Atalho que cria um `RoomMaker`, chama `init()` e depois `createRoom(params)`.

Parâmetros (`RoomParameters`):

- `name: string` – Nome da sala.
- `password: string` – Senha da sala (string vazia para sala sem senha).
- `maxPlayers: number` – Máximo de jogadores.
- `minLevel: number` – Nível mínimo exigido.
- `unlisted: boolean` – `true` para sala não listada.
- `mode: 'b' | 'bs' | 'ar' | 'ard' | 'sp' | 'v' | 'f'` – Modo de jogo.
- `rounds: number` – Quantidade de rounds.
- `maps: string[]` – Mapas a aplicar.
- `teams?: boolean` – Se `true`, ativa times.
- `favoriteIndex?: number` – Posição do mapa na lista de favoritos (0 = primeiro favorito).

Retorno (`RoomCreationResult`):

- `browser: Browser`
- `page: Page`
- `roomLink: string`
- `maps: string[]`

### `RoomMaker`

Classe de baixo nível usada por `startRoom`.  
Use se quiser controlar o fluxo manualmente:

```ts
import "dotenv/config";
import { RoomMaker } from "bonktools";

async function main() {
  const maker = new RoomMaker();
  await maker.init();

  const result = await maker.createRoom({
    name: "Sala manual",
    password: "",
    maxPlayers: 8,
    minLevel: 0,
    unlisted: false,
    mode: "f",
    rounds: 5,
    maps: [],
  });

  console.log("Link:", result.roomLink);
}

main().catch(console.error);
```

---

## API de bot (WebSocket)

Além do criador de salas, este pacote reexporta a API do bot original:

- `createBot(options)` – Cria e conecta um bot ao servidor do Bonk.io.
- `LOG_LEVELS` – Constantes de nível de log.

Exemplo básico:

```ts
import "dotenv/config";
import { createBot, LOG_LEVELS } from "bonktools";

const bot = createBot({
  account: {
    username: process.env.BOT_USERNAME,
    password: process.env.BOT_PASSWORD,
    guest: false,
  },
  PROTOCOL_VERSION: 49,
  server: "b2brazil1",
  logLevel: LOG_LEVELS.INFO,
});

bot.events.on("ready", () => {
  console.log("Bot conectado, pronto para usar.");
});
```

---

## Estrutura do projeto

Visão geral dos principais arquivos deste repositório (não necessariamente expostos pelo pacote):

- `src/lib/index.ts` – Ponto de entrada da biblioteca (`startRoom`, `RoomMaker`, `createBot`, `LOG_LEVELS`).
- `src/browser/roomMaker.ts` – Implementação do criador de salas (Puppeteer/Playwright + `sgrAPI`).
- `src/utils/botExtensions.ts` – Extensões úteis para o bot (ex.: `changeOtherTeam`).
- `src/bot.ts` – Exemplo de criação de bot usando `createBot`.
- `src/index.ts` – Runner de exemplo que carrega eventos e inicializa o bot.
- `dependencies/CondensedInjector.js` e `dependencies/sgrAPI.user.js` – Scripts injetados no jogo.

Como consumidor da biblioteca via NPM, você normalmente só precisa importar a partir de `bonktools` e trabalhar com as APIs descritas acima.
