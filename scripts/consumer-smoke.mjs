import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'waylit-consumer-'))

function npm(args, cwd) {
  return execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
}

try {
  const dryRun = JSON.parse(npm(['pack', '--dry-run', '--json'], root))[0]
  const packedFiles = new Set(dryRun.files.map((file) => file.path))
  for (const requiredFile of ['package.json', 'README.md', 'LICENSE', 'docs/sdk-contract.md', 'dist/sdk/index.js', 'dist/sdk/index.d.ts']) {
    assert(packedFiles.has(requiredFile), `Package is missing ${requiredFile}`)
  }
  for (const file of packedFiles) {
    assert(!file.startsWith('src/'), `Package unexpectedly contains source file ${file}`)
    assert(!file.startsWith('tests/'), `Package unexpectedly contains test file ${file}`)
    assert(!file.startsWith('scripts/'), `Package unexpectedly contains script ${file}`)
  }

  const tarball = JSON.parse(npm(['pack', '--json', '--pack-destination', temporaryDirectory], root))[0]
  const tarballPath = join(temporaryDirectory, tarball.filename)
  const consumerDirectory = join(temporaryDirectory, 'consumer')
  await mkdir(consumerDirectory)
  await writeFile(join(consumerDirectory, 'package.json'), JSON.stringify({ private: true, type: 'module' }))
  npm(['install', '--no-audit', '--no-fund', '--ignore-scripts', '--no-save', tarballPath], consumerDirectory)

  const fixtureDirectory = join(root, 'tests', 'consumer')
  await cp(join(fixtureDirectory, 'consumer.ts'), join(consumerDirectory, 'consumer.ts'))
  await writeFile(join(consumerDirectory, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      skipLibCheck: true,
      rootDir: '.',
      outDir: 'compiled',
    },
    include: ['consumer.ts'],
  }, null, 2))

  const tsc = join(root, 'node_modules', '.bin', 'tsc')
  execFileSync(tsc, ['--project', join(consumerDirectory, 'tsconfig.json')], { cwd: consumerDirectory, stdio: 'inherit' })
  const runtimeOutput = execFileSync(process.execPath, [join(consumerDirectory, 'compiled', 'consumer.js')], {
    cwd: consumerDirectory,
    encoding: 'utf8',
  })

  const packageJson = JSON.parse(await readFile(join(consumerDirectory, 'node_modules', 'waylit', 'package.json'), 'utf8'))
  assert.equal(packageJson.name, 'waylit')
  assert.equal(packageJson.private, undefined)
  assert.equal(Object.hasOwn(packageJson, 'dependencies'), false)
  console.log(`Consumer import, TypeScript check, runtime recommendation, and package contents passed (${packedFiles.size} files).`)
  process.stdout.write(runtimeOutput)
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
