import { defineConfig } from 'vite';

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
});
