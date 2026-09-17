# Registro público de IS blobs

`blobs.json` é um espelho estático e somente-leitura dos IS blobs (estado inicial da física) já capturados ao vivo do bonk.io — os mesmos dados embutidos em `GAMEMODE_DEFAULT_BLOBS`/`FOOTBALL_DEFAULT_BLOBS` do pacote [`bonktools`](https://www.npmjs.com/package/bonktools). Serve como um "GET público" simples para quem usa a lib e não quer/precisa rodar o próprio [blob-seeder](https://github.com/brenoluizdev/bonktools) para os mapas padrão.

## Por que estático em vez de uma API?

O volume de escrita é baixíssimo (um blob só muda quando alguém captura um mapa novo) e o acesso é quase 100% leitura. Um JSON versionado + CDN resolve sem precisar manter servidor, banco ou autenticação. Se um dia isso crescer para contribuições da comunidade em tempo real, uma API de verdade passa a fazer sentido — até lá, isso aqui basta.

## URLs

```
# sempre a versão mais recente do branch main
https://cdn.jsdelivr.net/gh/brenoluizdev/bonktools@main/registry/blobs.json

# via GitHub raw (sem cache de CDN, útil para debug)
https://raw.githubusercontent.com/brenoluizdev/bonktools/main/registry/blobs.json
```

Para pinar numa versão estável, use uma tag ao invés de `main` no jsDelivr:

```
https://cdn.jsdelivr.net/gh/brenoluizdev/bonktools@v0.1.0/registry/blobs.json
```

## Formato

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-09-17T...",
  "gamemodeDefaults": {
    // mapa fixo/padrão por gamemode — chave interna = nº de jogadores ativos (exclui bot)
    "football": { "map": "<blob LZ-String do campo>", "blobs": { "1": "...", "2": "...", "4": "..." } },
    "classic":  { "map": null, "blobs": { "1": "...", "2": "...", "4": "..." } },
    "vtol":     { "map": null, "blobs": { "...": "..." } },
    "grapple":  { "...": "..." },
    "arrows":   { "...": "..." },
    "death arrows": { "...": "..." }
  },
  "mapBlobs": {
    // futuro: blobs de mapas customizados, chave = hashMap(mapBlob) (sha256)
    // "<sha256>": { "1": "...", "2": "...", "4": "..." }
  }
}
```

`map: null` significa o mapa padrão/em branco do bonk.io (sem `SEND_MAP_ADD` customizado) — equivalente à chave sentinela `DEFAULT_MAP_ID` de `MapBlobCache`. `mapBlobs` começa vazio; é o espaço reservado para mapas customizados capturados no futuro (via `apps/blob-seeder` ou `capture-is.ts`).

## Consumindo na sua aplicação

```ts
const res = await fetch('https://cdn.jsdelivr.net/gh/brenoluizdev/bonktools@main/registry/blobs.json');
const registry = await res.json();

const blob = registry.gamemodeDefaults.vtol.blobs['2']; // vtol, mapa padrão, 1v1
```

Use isso como **fallback**, nunca como fonte primária: se você já capturou o blob do mapa atual da sua sala (via `MapBlobCache` local), ele é sempre mais correto do que os defaults daqui, que assumem o mapa padrão/fixo de cada gamemode.

## Contribuindo com blobs novos

Ainda é um processo manual: capture com `apps/blob-seeder` ou `capture-is.ts`, valide, e abra um PR editando `blobs.json` (adicionando em `mapBlobs`, com o `mapId` correto via `hashMap()`). Automação de submissão fica para quando houver demanda real.
