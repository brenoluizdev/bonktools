# Contribuindo

Obrigado pelo interesse em contribuir com o `bonktools`!

## Setup local

```bash
git clone https://github.com/brenoluizdev/bonktools.git
cd bonktools
pnpm install
pnpm test
```

Requisitos: Node.js >= 20.18.1 e [pnpm](https://pnpm.io/).

## Scripts

| Comando | Descrição |
|---|---|
| `pnpm build` | Compila `src/` para `dist/` (ESM + CJS + types) via tsup |
| `pnpm test` | Roda a suíte de testes (vitest) |
| `pnpm dev` | Testes em modo watch |

## Testes de integração ao vivo

Alguns testes conectam de verdade ao bonk.io e ficam pulados por padrão. Para rodá-los:

```bash
BONK_INTEGRATION=1 BONK_USERNAME=... BONK_PASSWORD=... pnpm test
```

Use uma conta descartável — nunca credenciais de produção.

## Enviando um Pull Request

1. Crie um branch a partir de `main`.
2. Escreva testes para qualquer comportamento novo ou corrigido.
3. Garanta que `pnpm build` e `pnpm test` passam.
4. Descreva no PR o quê e o porquê da mudança.

## Reportando bugs

Abra uma [issue](https://github.com/brenoluizdev/bonktools/issues) com:
- Versão do pacote e do Node.js
- Passos para reproduzir
- Comportamento esperado vs. observado

Nunca inclua credenciais (`BONK_USERNAME`/`BONK_PASSWORD`) ou tokens de sessão em issues ou logs colados.
