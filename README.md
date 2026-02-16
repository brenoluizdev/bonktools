# FUTHERO Bonk.io Rooms

Bot que cria e gerencia salas no [Bonk.io](https://bonk.io) via Puppeteer. Suporta vários modos de jogo, cada um com suas regras, mapa e comandos.

## Requisitos

- Node.js 18+
- Chrome/Chromium
- Arquivos em `dependencies/`: `CondensedInjector.js` e `sgrAPI.user.js` (use `download-scripts.sh` se precisar)

## Configuração

1. Copie `.env.example` para `.env`
2. Defina `BOT_USERNAME` e `BOT_PASSWORD` (conta Bonk.io)
3. `MODE=mbappa2x2` (padrão) — 2v2 futsal, 5 pontos, mapa favorito
4. Opcional: `ROOM_NAME`, `ROOM_PASSWORD`, `ROOM_MAX_PLAYERS`, `DISCORD_SERVER_LINK`, `HEADLESS=1`

## Uso

```bash
npm install
npm run dev:new
```

O bot cria a sala e exibe o link. Comandos gerais em todos os modos: `!help` `!ping` `!queue` `!r` `!reset` `!cancel` `!discord`.

### Modo MBAPPA 2X2

- 2 jogadores no time vermelho e 2 no azul; todos dão Ready (botão ou !r) para iniciar.
- Partida em primeiro a 5 gols; mapa é o primeiro favorito da conta.
- Ao terminar: se 1 no spec, ele digita `!p <abreviação>` para escolher o parceiro (o outro fica no spec); se 2 no spec, entram no lugar dos perdedores.

## Scripts

- `npm run dev:new` — com janela
- `npm run dev:new:headless` — headless
- `npm run build` / `npm start` — build e execução

## Estrutura

- `src/index-new.ts` — entrada, escolhe modo via `MODE` e inicia sala
- `src/modes/types.ts` — interface dos modos
- `src/modes/mbappa2x2/` — modo MBAPPA 2X2 (2v2, 5 pts, !p)
- `src/modes/common/` — comandos gerais
- `src/browser/roomMaker.ts` — criação da sala (Puppeteer)
- `src/room/bonkRoom.ts` — gestão da sala (delega ao modo)
- `config/room.ts` — configuração base da sala
