import react from '@vitejs/plugin-react-swc'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'

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
      {
        name: 'dev-console-logger',
        configureServer(server) {
          server.middlewares.use('/__log', (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end()
              return
            }

            let body = ''
            req.on('data', (chunk) => {
              body += chunk
            })
            req.on('end', () => {
              try {
                const payload = JSON.parse(body || '{}') as {
                  label?: string
                  message?: unknown
                }
                const label = payload.label ?? 'log'
                if (typeof payload.message === 'string') {
                  console.log(`[web:${label}] ${payload.message}`)
                } else {
                  console.log(`[web:${label}]`, payload.message)
                }
                res.statusCode = 204
                res.end()
              } catch (error) {
                console.warn('[web:log] bad payload', error)
                res.statusCode = 400
                res.end()
              }
            })
          })
        }
      }
    ],
    base: getBase(mode),
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    // resolve: {
    //   alias: [
    //     {
    //       find: 'dsssp/font',
    //       replacement: path.resolve(__dirname, '../dsssp-io/dist/index.css')
    //     },
    //     {
    //       find: 'dsssp',
    //       replacement: path.resolve(__dirname, '../dsssp-io/dist')
    //     }
    //   ]
    // },
    server: {
      port: 3003,
      open: true,
      host: true,
      cors: true,
      historyApiFallback: true
    },
    build: {
      sourcemap: true,
      rollupOptions: {}
    }
  }
})
