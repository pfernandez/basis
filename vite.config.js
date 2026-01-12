import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  root: 'src/vis',
  base: './',
  build: {
    outDir: '../../dist/vis',
    emptyOutDir: true,
  },
  server: {
    open: true,
    port: 8000,
    strictPort: true,
  },
  plugins: [wasm(), topLevelAwait()]
});
