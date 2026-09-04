import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 개발 중 /api 는 Spring(기본 8080)으로 프록시. 배포는 nginx 가 /api → backend (도윤 인프라).
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: { '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080', changeOrigin: true } },
  },
})
