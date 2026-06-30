import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      // Forward API calls to the Laravel Demo API (served by Herd) to avoid CORS in dev.
      '/api': {
        target: 'http://laravel-demo-api.test',
        changeOrigin: true,
      },
    },
  },
})
