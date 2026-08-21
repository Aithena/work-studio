import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const require = createRequire(import.meta.url)

function bindingExists(pkgDir) {
  return fs.existsSync(path.join(pkgDir, 'build', 'Release', 'better_sqlite3.node'))
}

function main() {
  let pkgJson
  try {
    pkgJson = require.resolve('better-sqlite3/package.json')
  } catch {
    return
  }

  const pkgDir = path.dirname(pkgJson)
  if (bindingExists(pkgDir)) return

  try {
    require('better-sqlite3')
    return
  } catch {
    // continue to download
  }

  const version = require(pkgJson).version
  const abi = process.versions.modules
  const file = `better-sqlite3-v${version}-node-v${abi}-${os.platform()}-${os.arch()}.tar.gz`
  const url = `https://cdn.npmmirror.com/binaries/better-sqlite3/v${version}/${file}`
  const dest = path.join(os.tmpdir(), file)

  console.log(`[work-studio] downloading sqlite prebuild ${file}`)
  execFileSync('curl', ['-L', '--fail', '-o', dest, url], { stdio: 'inherit' })
  execFileSync('tar', ['-xzf', dest, '-C', pkgDir], { stdio: 'inherit' })

  if (!bindingExists(pkgDir)) {
    throw new Error('sqlite prebuild extracted but native binding is still missing')
  }
}

main()
