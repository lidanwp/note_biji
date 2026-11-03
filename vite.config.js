import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src')
    }
  },
  build: {
    // 代码分割：将大型依赖拆分为独立 chunk，便于浏览器缓存
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vue') || id.includes('node_modules/vue-router') || id.includes('node_modules/pinia')) {
            return 'vue-vendor'
          }
          if (id.includes('node_modules/markdown-it')) {
            return 'markdown'
          }
          // md-editor-v3 + shiki 语言包 - 体积很大但仅在编辑页使用
          if (id.includes('node_modules/md-editor-v3') || id.includes('node_modules/@shiki') || id.includes('node_modules/shiki')) {
            return 'editor'
          }
          // 其他 node_modules 合并
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        }
      }
    },
    chunkSizeWarningLimit: 600,
    // 使用默认压缩（Vite 8 + rolldown 默认使用 oxc）
    cssCodeSplit: true,
    sourcemap: false
  },
  server: {
    port: 5173,
    open: true,
    host: true,
    proxy: {
      '/api': {
        target: 'https://bdxxg.asia',
        changeOrigin: true,
        secure: true
      }
    }
  }
})
