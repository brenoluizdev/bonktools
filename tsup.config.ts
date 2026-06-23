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
    entry: { 'cli/capture-is': 'src/cli/capture-is.ts' },
    format: ['esm'],
    dts: false,
    sourcemap: false,
    external: ['socket.io-client'],
    banner: { js: '#!/usr/bin/env node' },
  },
]);
