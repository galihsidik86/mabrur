import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/admin/', // disajikan di https://mabrur.sosmartpro.com/admin
  plugins: [react()],
  server: { port: 5173, fs: { allow: ['../..'] } },
});
