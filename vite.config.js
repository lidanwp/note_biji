import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import http from 'http'
import https from 'https'

const supabaseUrl = 'https://oobypberpdpizktzlbph.supabase.co'
const supabaseKey = 'sb_publishable_KacaVTayTEo0hWOyyMfw1Q_WSMdGKxQ'

/**
 * Vite 插件：代理评论删除请求到 Supabase REST API
 * 绕过浏览器 CORS 限制和远程服务器的 bug
 */
function commentsDeleteProxy() {
  return {
    name: 'comments-delete-proxy',
    configureServer(server) {
      server.middlewares.use('/api/comments/delete', (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const id = url.searchParams.get('id') || url.searchParams.get('select')
        const method = req.method

        if (method !== 'DELETE') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const targetPath = '/rest/v1/comments' + (req.url.split('?')[1] ? '?' + req.url.split('?')[1] : '')

        const options = {
          hostname: 'oobypberpdpizktzlbph.supabase.co',
          path: targetPath,
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }

        console.log('[proxy] DELETE', targetPath)

        const proxyReq = https.request(options, (proxyRes) => {
          let data = ''
          proxyRes.on('data', (chunk) => { data += chunk })
          proxyRes.on('end', () => {
            res.statusCode = proxyRes.statusCode || 500
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.end(data || JSON.stringify({ success: true }))
          })
        })

        proxyReq.on('error', (err) => {
          console.error('[proxy error]', err.message)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }))
        })

        proxyReq.end()
      })
    }
  }
}

export default defineConfig({
  plugins: [vue(), commentsDeleteProxy()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
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
          if (id.includes('node_modules/@supabase')) {
            return 'supabase'
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
