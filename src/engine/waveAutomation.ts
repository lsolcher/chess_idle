/**

 * Auto-advance wave automation (Phase 5 — idle loop polish).

 * After a clear, prep opens immediately; optional delay then auto-starts the next wave.

 */



/** Minimum stage before the automation upgrade appears in the shop (GDD §3.1 band 6–9). */

export const AUTO_ADVANCE_UNLOCK_STAGE = 6



/** One-time gold cost for the Auto-Advance Waves upgrade. */

export const AUTO_ADVANCE_WAVE_COST = 750



/** Delay after dismissing the clear modal before optional auto-start. */

export const AUTO_ADVANCE_DELAY_MS = 1_200



export interface AutoAdvanceTickInput {

  wavePhase: 'WAVE_PREP' | 'WAVE_ACTIVE' | 'WAVE_COMPLETE'

  purchased: boolean

  enabled: boolean

  waveCompleteAtMs: number | null

  nowMs: number

  autoStartNextWave: boolean

  /** True while the wave outcome modal is open — blocks auto-start until dismissed. */

  prepUiBlocked?: boolean

}



export interface AutoAdvanceTickResult {

  waveCompleteAtMs: number | null

  shouldStartWave: boolean

}



/**

 * Determines whether the idle loop should auto-start the next wave from prep.

 */

export function evaluateAutoAdvanceTick(input: AutoAdvanceTickInput): AutoAdvanceTickResult {

  if (!input.purchased || !input.enabled) {

    return {

      waveCompleteAtMs: null,

      shouldStartWave: false,

    }

  }



  if (input.prepUiBlocked) {

    return {

      waveCompleteAtMs: input.waveCompleteAtMs,

      shouldStartWave: false,

    }

  }



  if (input.wavePhase !== 'WAVE_PREP' || input.waveCompleteAtMs == null) {

    return {

      waveCompleteAtMs: input.wavePhase === 'WAVE_PREP' ? input.waveCompleteAtMs : null,

      shouldStartWave: false,

    }

  }



  const startedAt = input.waveCompleteAtMs

  const elapsed = input.nowMs - startedAt

  if (elapsed < AUTO_ADVANCE_DELAY_MS) {

    return {

      waveCompleteAtMs: startedAt,

      shouldStartWave: false,

    }

  }



  return {

    waveCompleteAtMs: null,

    shouldStartWave: input.autoStartNextWave,

  }

}


