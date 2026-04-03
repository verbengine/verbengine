import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/api/index.ts'),
      name: 'verbengine',
      fileName: 'verbengine',
      formats: ['es', 'cjs'],
    },
    outDir: 'dist/lib',
    emptyOutDir: true,
    rollupOptions: {
      external: ['phaser'],
      output: {
        globals: {
          phaser: 'Phaser',
        },
      },
    },
  },
});
