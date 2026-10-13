import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// custom domain (root): fastlineinfinitiq.pl
export default defineConfig({
  base: '/',
  plugins: [react()],
  // manifest: prerender dopisuje <link rel="modulepreload"> paczki strony (bez kaskady pobrań)
  build: { outDir: 'dist', manifest: true },
});
