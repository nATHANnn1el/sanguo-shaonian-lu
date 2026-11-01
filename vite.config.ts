import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2020', sourcemap: false },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
