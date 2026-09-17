import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['socket.io-client'],
  },
  {
    // Sem "banner" aqui: esbuild já hoisteia o shebang de src/cli/capture-is.ts
    // (linha 1 do fonte) para o topo do bundle. Um banner explícito duplicaria
    // a linha — a segunda ocorrência quebra como JS válido (Node só trata "#!"
    // como shebang na linha 1; na linha 2 é SyntaxError).
    entry: { 'cli/capture-is': 'src/cli/capture-is.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: false,
    external: ['socket.io-client'],
  },
]);
