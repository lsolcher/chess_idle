import fs from 'node:fs'

const path = new URL('../src/store/gameStore.ts', import.meta.url)
let s = fs.readFileSync(path, 'utf8')

const start = s.indexOf(
  '    /**\n     * Ends the active manual turn when the piece has no legal moves (pass).\n     */',
)
const prepStart = s.indexOf(
  '    /** Selects a friendly piece to reposition on deploy ranks between waves. */',
)
const purchaseStart = s.indexOf(
  '    /** Purchases a catalog offer by id; rebuilds piece stats on success. */',
)
const purchaseEnd = s.indexOf('    /**\n     * Called after localStorage hydrate')

if ([start, prepStart, purchaseStart, purchaseEnd].some((i) => i < 0)) {
  console.error('markers not found', { start, prepStart, purchaseStart, purchaseEnd })
  process.exit(1)
}

const head = `    skipManualTurn(nowMs = Date.now()): boolean {
      return combat().skipManualTurn(nowMs)
    },

    beginManualPlayerTurn(pieceId: string, nowMs = Date.now()): void {
      combat().beginManualPlayerTurn(pieceId, nowMs)
    },

    selectManualPiece(pieceId: string, nowMs = Date.now()): boolean {
      if (this.autoMode || this.wavePhase !== 'WAVE_ACTIVE') return false
      const actor = getNextReadyActor(this.playerPieces, this.enemyPieces, nowMs)
      if (!actor || actor.side !== 'player' || actor.id !== pieceId) return false
      this.manualPendingPieceId = pieceId
      this.combatFocus = 'move'
      return true
    },

    scheduleEnemyAfterAction(pieceId: string, nowMs = Date.now()): void {
      combat().scheduleEnemyAfterAction(pieceId, nowMs)
    },

    schedulePlayerAfterAction(pieceId: string, nowMs = Date.now()): void {
      combat().schedulePlayerAfterAction(pieceId, nowMs)
    },

    recordKingFailAttribution(
      attribution: import('@/types/game').KingFailAttribution,
    ): void {
      combat().recordKingFailAttribution(attribution)
    },

`

const combatTail = `    startCombatLoop(nowMs = Date.now()): void {
      combat().startCombatLoop(nowMs)
    },

    stopCombatLoop(): void {
      combat().stopCombatLoop()
    },

    processPromotionForPiece(pieceId: string, chosenForm?: SuperPromotionForm): number {
      return combat().processPromotionForPiece(pieceId, chosenForm)
    },

    choosePromotionForm(form: SuperPromotionForm, nowMs = Date.now()): void {
      combat().choosePromotionForm(form, nowMs)
    },

    dismissPendingPromotion(): void {
      combat().dismissPendingPromotion()
    },

    executePlayerManualMove(move: BoardMove, nowMs = Date.now()): number {
      return combat().executePlayerManualMove(move, nowMs)
    },

    resolvePlayerMove(
      move: BoardMove,
      nowMs = Date.now(),
      options?: { trackCombat?: boolean },
    ): number {
      return combat().resolvePlayerMove(move, nowMs, options)
    },

    resolveEnemyMove(move: BoardMove, nowMs = Date.now()): void {
      combat().resolveEnemyMove(move, nowMs)
    },

    processEnemyPawnLeaks(): void {
      combat().processEnemyPawnLeaks()
    },

    tickBossAfterEnemyAction(actedEnemyId: string, nowMs = Date.now()): void {
      combat().tickBossAfterEnemyAction(actedEnemyId, nowMs)
    },

    executeEnemyMove(pieceId: string, nowMs = Date.now()): boolean {
      return combat().executeEnemyMove(pieceId, nowMs)
    },

    tickEnemyInitiative(nowMs = Date.now()): string[] {
      return combat().tickEnemyInitiative(nowMs)
    },

    executePlayerAutoMove(pieceId: string, nowMs = Date.now()): number {
      return combat().executePlayerAutoMove(pieceId, nowMs)
    },

    regenStamina(deltaSec: number): void {
      combat().regenStamina(deltaSec)
    },

    spendStaminaForClick(): boolean {
      return combat().spendStaminaForClick()
    },

    clickEnemyPiece(enemyPieceId: string, nowMs = Date.now()): number {
      return combat().clickEnemyPiece(enemyPieceId, nowMs)
    },

    tickCombat(nowMs = Date.now()) {
      return combat().tickCombat(nowMs)
    },

`

const purchaseBlock = `    purchaseUpgradeOffer(offerId: string): boolean {
      return economy().purchaseUpgradeOffer(offerId)
    },

    purchaseBestRoiUpgrade(): boolean {
      return economy().purchaseBestRoiUpgrade()
    },

`

const prepSection = s.slice(prepStart, purchaseStart)

const newS =
  s.slice(0, start) +
  head +
  prepSection +
  combatTail +
  purchaseBlock +
  s.slice(purchaseEnd)

fs.writeFileSync(path, newS)
console.log('patched', newS.split('\n').length, 'lines')
