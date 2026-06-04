/**
 * Per-wave combat telemetry and outcome reports for the modular results modal.
 */

export interface WaveCombatStats {
  damageDealt: number
  damageTaken: number
  goldFromCaptures: number
  goldFromActions: number
  goldFromClear: number
  goldFromPromotion: number
  captures: number
  friendlyActions: number
}

export type WaveOutcomeKind = 'victory' | 'defeat' | 'prep'

export interface WaveOutcomeReport {
  kind: WaveOutcomeKind
  /** Stage number fought this wave (before victory advance). */
  foughtStage: number
  /** Stage after outcome (prep target). */
  nextStage: number
  stats: WaveCombatStats
  trophyName: string | null
  failRewindToStage: number | null
  checkpointStage: number
  failCountThisStage: number
  enemyHpScale: number
  kingFallMessage: string
  kingFallTelegraph: string
}

export function createEmptyWaveCombatStats(): WaveCombatStats {
  return {
    damageDealt: 0,
    damageTaken: 0,
    goldFromCaptures: 0,
    goldFromActions: 0,
    goldFromClear: 0,
    goldFromPromotion: 0,
    captures: 0,
    friendlyActions: 0,
  }
}

export function totalWaveGold(stats: WaveCombatStats): number {
  return (
    stats.goldFromCaptures +
    stats.goldFromActions +
    stats.goldFromClear +
    stats.goldFromPromotion
  )
}

export function accumulateWaveCombatStats(
  stats: WaveCombatStats,
  delta: Partial<WaveCombatStats>,
): WaveCombatStats {
  return {
    damageDealt: stats.damageDealt + (delta.damageDealt ?? 0),
    damageTaken: stats.damageTaken + (delta.damageTaken ?? 0),
    goldFromCaptures: stats.goldFromCaptures + (delta.goldFromCaptures ?? 0),
    goldFromActions: stats.goldFromActions + (delta.goldFromActions ?? 0),
    goldFromClear: stats.goldFromClear + (delta.goldFromClear ?? 0),
    goldFromPromotion: stats.goldFromPromotion + (delta.goldFromPromotion ?? 0),
    captures: stats.captures + (delta.captures ?? 0),
    friendlyActions: stats.friendlyActions + (delta.friendlyActions ?? 0),
  }
}

export interface BuildVictoryReportInput {
  foughtStage: number
  nextStage: number
  stats: WaveCombatStats
  trophyName: string | null
  checkpointStage: number
}

export function buildVictoryReport(input: BuildVictoryReportInput): WaveOutcomeReport {
  return {
    kind: 'victory',
    foughtStage: input.foughtStage,
    nextStage: input.nextStage,
    stats: input.stats,
    trophyName: input.trophyName,
    failRewindToStage: null,
    checkpointStage: input.checkpointStage,
    failCountThisStage: 0,
    enemyHpScale: 1,
    kingFallMessage: '',
    kingFallTelegraph: '',
  }
}

export interface BuildDefeatReportInput {
  foughtStage: number
  nextStage: number
  stats: WaveCombatStats
  failRewindToStage: number | null
  checkpointStage: number
  failCountThisStage: number
  enemyHpScale: number
  kingFallMessage: string
  kingFallTelegraph: string
}

export function buildDefeatReport(input: BuildDefeatReportInput): WaveOutcomeReport {
  return {
    kind: 'defeat',
    foughtStage: input.foughtStage,
    nextStage: input.nextStage,
    stats: input.stats,
    trophyName: null,
    failRewindToStage: input.failRewindToStage,
    checkpointStage: input.checkpointStage,
    failCountThisStage: input.failCountThisStage,
    enemyHpScale: input.enemyHpScale,
    kingFallMessage: input.kingFallMessage,
    kingFallTelegraph: input.kingFallTelegraph,
  }
}

/** Prep-phase summary after dismissing victory (optional follow-up screen). */
export function buildPrepPhaseReport(
  input: Omit<BuildVictoryReportInput, 'trophyName'> & { trophyName?: string | null },
): WaveOutcomeReport {
  const victory = buildVictoryReport({
    ...input,
    trophyName: input.trophyName ?? null,
  })
  return { ...victory, kind: 'prep' }
}
