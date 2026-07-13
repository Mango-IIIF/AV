import { defineConfig } from 'vite';

export default defineConfig({
  root: 'demo',
  server: {
    port: 4173,
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: '../demo-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: new URL('./demo/index.html', import.meta.url).pathname,
        api: new URL('./demo/api.html', import.meta.url).pathname,
        composable: new URL('./demo/composable.html', import.meta.url).pathname,
      },
    },
  },
});
