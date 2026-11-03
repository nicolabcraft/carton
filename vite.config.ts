import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Tauri serves `dist/` in the release build and this dev server in `tauri dev`.
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: { port: 5175, strictPort: true },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true }
});
