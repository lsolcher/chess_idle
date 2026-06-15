#!/usr/bin/env node
/**
 * Headless balance report — `node scripts/balance-sim.js`
 * Runs the Vitest balance snapshot (same engine as CI) and prints balance-report.txt.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const result = spawnSync(
  'npm',
  ['test', '--', 'src/engine/balanceSimulation.test.ts', '-t', 'writes balance'],
  { cwd: root, stdio: 'inherit', shell: true },
)
if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const reportPath = join(root, 'balance-report.txt')
console.log(readFileSync(reportPath, 'utf8'))
