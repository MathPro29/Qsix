import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// พอร์ต dev ใช้ 5174 (ต่างจาก backend ที่ 5173) และ proxy /api ไปหา backend
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    proxy: {
      '/api': 'http://localhost:5173',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
