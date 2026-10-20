export interface AutoPauseOptions {
  /** Pause when speed stays below this (m/s)... */
  stopBelow: number
  /** ...for this long (ms). */
  stopAfterMs: number
  /** Resume when speed stays above this (m/s)... */
  resumeAbove: number
  /** ...for this long (ms). */
  resumeAfterMs: number
}

export const DEFAULT_AUTOPAUSE: AutoPauseOptions = {
  stopBelow: 0.6,
  stopAfterMs: 5000,
  resumeAbove: 1.2,
  resumeAfterMs: 2000,
}

/** Speed-threshold state machine with hysteresis. */
export class AutoPause {
  paused = false
  private since: number | null = null

  constructor(private readonly opts: AutoPauseOptions = DEFAULT_AUTOPAUSE) {}

  update(t: number, speed: number): 'pause' | 'resume' | null {
    const { stopBelow, stopAfterMs, resumeAbove, resumeAfterMs } = this.opts
    const wantsToggle = this.paused ? speed > resumeAbove : speed < stopBelow
    if (!wantsToggle) {
      this.since = null
      return null
    }
    this.since ??= t
    if (t - this.since < (this.paused ? resumeAfterMs : stopAfterMs)) return null
    this.paused = !this.paused
    this.since = null
    return this.paused ? 'pause' : 'resume'
  }

  /** Called when the user pauses/resumes manually so state stays in sync. */
  set(paused: boolean) {
    this.paused = paused
    this.since = null
  }
}
