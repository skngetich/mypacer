import { paceToSpeech } from './pace'
import { unitWord, type Unit } from './units'

export interface AnnouncerSettings {
  unit: Unit
  /** Distance between announcements in units; 0 = off */
  splitDistance: number
  /** Minutes between announcements; 0 = off */
  intervalMin: number
  targetEnabled: boolean
  /** Target pace in seconds per unit */
  targetPace: number
  /** Allowed deviation from target in seconds */
  tolerance: number
}

export interface Snapshot {
  /** Active time in ms */
  at: number
  /** Current pace in seconds per unit */
  pace: number | null
  paused: boolean
}

export const ALERT_GRACE_MS = 60_000
export const ALERT_COOLDOWN_MS = 30_000
/** Skip a time announcement if a distance one was just spoken. */
const DEDUPE_MS = 10_000

/** Decides what to say and when. Returns text; speaking it is someone else's job. */
export class Announcer {
  private nextIntervalAt: number | null = null
  private lastAnnouncedAt = -Infinity
  private lastAlertAt = -Infinity
  private alerted = false

  constructor(private readonly settings: () => AnnouncerSettings) {}

  /** The runner just passed the n-th announcement distance. */
  marker(n: number, snap: Snapshot): string {
    const { unit, splitDistance } = this.settings()
    const dist = round2(n * splitDistance)
    this.lastAnnouncedAt = snap.at
    return `${dist} ${unitWord(unit, dist)}. ${this.paceText(snap)}`
  }

  /** Call about once a second. Returns anything due to be spoken. */
  tick(snap: Snapshot): string[] {
    const s = this.settings()
    const out: string[] = []

    if (s.intervalMin > 0) {
      const every = s.intervalMin * 60_000
      this.nextIntervalAt ??= every
      if (snap.at >= this.nextIntervalAt) {
        const minutes = Math.floor(snap.at / every) * s.intervalMin
        while (this.nextIntervalAt <= snap.at) this.nextIntervalAt += every
        if (snap.at - this.lastAnnouncedAt > DEDUPE_MS) {
          out.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}. ${this.paceText(snap)}`)
          this.lastAnnouncedAt = snap.at
        }
      }
    } else {
      this.nextIntervalAt = null
    }

    if (s.targetEnabled && !snap.paused && snap.at >= ALERT_GRACE_MS && snap.pace != null) {
      const tooSlow = snap.pace > s.targetPace + s.tolerance
      const tooFast = snap.pace < s.targetPace - s.tolerance
      if ((tooSlow || tooFast) && snap.at - this.lastAlertAt >= ALERT_COOLDOWN_MS) {
        const justSaidPace = snap.at - this.lastAnnouncedAt <= DEDUPE_MS
        out.push(`${tooSlow ? 'Speed up' : 'Slow down'}.${justSaidPace ? '' : ` ${this.paceText(snap)}`}`)
        this.lastAlertAt = snap.at
        this.alerted = true
      } else if (!tooSlow && !tooFast && this.alerted) {
        out.push('Back on target.')
        this.alerted = false
      }
    }
    return out
  }

  onDemand(snap: Snapshot): string {
    return snap.paused ? `Paused. ${this.paceText(snap)}` : this.paceText(snap)
  }

  private paceText(snap: Snapshot): string {
    return snap.pace == null ? 'Pace not available yet.' : `Pace ${paceToSpeech(snap.pace)}.`
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
