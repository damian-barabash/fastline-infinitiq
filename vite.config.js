import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// custom domain (root): fastlineinfinitiq.pl
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: { outDir: 'dist' },
});
