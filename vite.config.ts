/* eslint-disable @typescript-eslint/no-unused-vars */
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'
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
    plugins: [svgr(), react(), logProxyPlugin()],
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
      rollupOptions: {}
    }
  }
})
