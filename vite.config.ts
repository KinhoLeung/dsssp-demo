/* eslint-disable @typescript-eslint/no-unused-vars */
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'
import { VitePWA } from 'vite-plugin-pwa'
import util from 'node:util'

const logProxyPlugin = () => ({
  name: 'log-proxy',
  configureServer(server: { middlewares: { use: Function } }) {
    server.middlewares.use('/__log', (req: any, res: any) => {
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.end()
        return
      }

      let body = ''
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString()
        if (body.length > 1_000_000) {
          res.statusCode = 413
          res.end()
          req.destroy()
        }
      })

      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}')
          const level = typeof payload.level === 'string' ? payload.level : 'log'
          const args = Array.isArray(payload.args) ? payload.args : [payload.args]
          const ts = payload.ts ? new Date(payload.ts).toISOString() : new Date().toISOString()
          const prefix = `[web:${level}] ${ts}`
          const logger = (console as any)[level] || console.log
          const formattedArgs = args.map((arg: any) =>
            typeof arg === 'object' && arg !== null
              ? util.inspect(arg, { depth: null, colors: true, breakLength: 100 })
              : arg
          )
          logger(prefix, ...formattedArgs)
        } catch {
          console.log('[web:log] invalid payload')
        }

        res.statusCode = 204
        res.end()
      })
    })
  }
})

const getBase = (mode: string) => {
  switch (mode) {
    case 'github':
      return '/dsssp-demo/'
    case 'landing':
      return '/demo'
    case 'development':
    default:
      return '/'
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [
      svgr(),
      react(),
      logProxyPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon-32x32.png', 'favicon-16x16.png', 'apple-touch-icon.png'],
        manifest: {
          name: 'WebHMI',
          short_name: 'WebHMI',
          description: 'WebHMI - Cross-platform Hardware Debugging & Control Panel',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          icons: [
            {
              src: 'android-chrome-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'android-chrome-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    base: getBase(mode),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 3003,
      open: true,
      host: true,
      cors: true,
      historyApiFallback: true
    },
    build: {
      minify: 'terser', // 指定使用 terser
      terserOptions: {
        compress: {
          drop_console: true, // 生产环境移除 console
          // 需要保留 src/utils/security.ts 的反调试 debugger；不要全局移除
          drop_debugger: false,
        },
        mangle: {
          // 在这里可以定义更激进的混淆策略
          toplevel: true, // 混淆最高层的变量名
          keep_classnames: false,
          keep_fnames: false,
        },
        format: {
          comments: false, // 移除所有注释
        },
      },
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/')

            if (
              normalizedId.includes('/node_modules/react/') ||
              normalizedId.includes('/node_modules/react-dom/') ||
              normalizedId.includes('/node_modules/react-router/') ||
              normalizedId.includes('/node_modules/react-router-dom/')
            ) {
              return 'vendor-react'
            }

            if (normalizedId.includes('/node_modules/dsssp/')) {
              return 'vendor-dsssp'
            }

            if (normalizedId.includes('/src/device/proto/')) {
              return 'vendor-proto'
            }

            if (
              normalizedId.includes('/node_modules/react-markdown/') ||
              normalizedId.includes('/node_modules/remark-gfm/') ||
              normalizedId.includes('/node_modules/rehype-slug/')
            ) {
              return 'vendor-docs'
            }

            if (
              normalizedId.includes('/node_modules/motion/')
            ) {
              return 'vendor-motion'
            }
          },
        },
      }
    }
  }
})
