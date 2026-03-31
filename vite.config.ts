import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'esnext',
    // Inline all assets (images, fonts, etc.) up to this size
    assetsInlineLimit: 100_000_000,
  },
});
