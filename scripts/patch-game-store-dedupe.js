import fs from 'node:fs'

const path = new URL('../src/store/gameStore.ts', import.meta.url)
let s = fs.readFileSync(path, 'utf8')

const oldStart = s.indexOf('    startCombatLoop(nowMs = Date.now()): void {\n      this.combatLoopRunning = true')
const delegateStart = s.indexOf('    startCombatLoop(nowMs = Date.now()): void {\n      combat().startCombatLoop(nowMs)')

if (oldStart < 0 || delegateStart < 0 || oldStart >= delegateStart) {
  console.error('markers', { oldStart, delegateStart })
  process.exit(1)
}

const newS = s.slice(0, oldStart) + s.slice(delegateStart)
fs.writeFileSync(path, newS)
console.log('removed duplicate block', newS.split('\n').length, 'lines')
