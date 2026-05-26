import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5110,
    proxy: { '/api': 'http://localhost:5100' },
  },
});
