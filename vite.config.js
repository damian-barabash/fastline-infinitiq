import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// custom domain (root): infinitiq.fastline.pl
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: { outDir: 'dist' },
});
