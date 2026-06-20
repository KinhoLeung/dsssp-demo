import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { existsSync, watch as watchFs } from 'node:fs'
import { mkdir, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const testsDir = path.join(rootDir, 'tests')
const scratchDir = path.join(os.tmpdir(), 'dsssp-demo-tests')
const outDir = path.join(scratchDir, 'test-bundle')
const withCoverage = process.argv.includes('--coverage')
const watch = process.argv.includes('--watch')

const resolveExistingPath = (candidate) => {
  if (existsSync(candidate)) return candidate
  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']) {
    const withExt = `${candidate}${ext}`
    if (existsSync(withExt)) return withExt
  }
  return candidate
}

const aliasPlugin = {
  name: 'webhmi-test-alias',
  setup(buildApi) {
    buildApi.onResolve({ filter: /^@\// }, (args) => ({
      path: resolveExistingPath(path.join(rootDir, 'src', args.path.slice(2))),
    }))
  },
}

async function findTests(dir) {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true })
  const out = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...await findTests(fullPath))
    } else if (/\.test\.tsx?$/.test(entry.name)) {
      out.push(fullPath)
    }
  }
  return out
}

async function bundleTests() {
  const tests = await findTests(testsDir)
  if (tests.length === 0) {
    console.log('No test files found.')
    return []
  }

  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  const bundled = []
  for (const testFile of tests) {
    const rel = path.relative(testsDir, testFile)
    const outFile = path.join(outDir, rel).replace(/\.tsx?$/, '.mjs')
    await mkdir(path.dirname(outFile), { recursive: true })
    await build({
      entryPoints: [testFile],
      outfile: outFile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      sourcemap: 'inline',
      plugins: [aliasPlugin],
      define: {
        'import.meta.env.DEV': 'true',
        'import.meta.env.PROD': 'false',
        'import.meta.env.VITE_PROTOCOL_LOGS': '"false"',
      },
      external: ['node:*'],
      logLevel: 'silent',
    })
    bundled.push(outFile)
  }
  return bundled
}

async function runOnce() {
  const bundled = await bundleTests()
  if (bundled.length === 0) return 0

  const env = { ...process.env }
  if (withCoverage) {
    env.NODE_V8_COVERAGE = path.join(scratchDir, 'coverage')
  }

  const args = ['--test', ...bundled]
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: rootDir,
      env,
      stdio: 'inherit',
    })
    child.on('exit', (code) => resolve(code ?? 1))
  })
}

if (watch) {
  let running = false
  let queued = false

  const rerun = async () => {
    if (running) {
      queued = true
      return
    }
    running = true
    const exitCode = await runOnce()
    if (exitCode !== 0) {
      console.error(`Tests failed with exit code ${exitCode}`)
    }
    running = false
    if (queued) {
      queued = false
      await rerun()
    }
  }

  await rerun()
  console.log('Watching src/ and tests/ for changes...')
  for (const dir of [path.join(rootDir, 'src'), testsDir]) {
    if (!existsSync(dir)) continue
    watchFs(dir, { recursive: true }, () => {
      void rerun()
    })
  }
  process.stdin.resume()
} else {
  const exitCode = await runOnce()
  if (withCoverage) {
    console.log(`Raw V8 coverage written to ${path.join(scratchDir, 'coverage')}`)
  }
  process.exit(exitCode)
}
