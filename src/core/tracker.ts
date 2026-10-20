import { AutoPause } from './autopause'
import { FixFilter, haversine, type Fix } from './geo'
import { rollingPace } from './pace'
import { SplitTracker, type Split } from './splits'

export interface TrackPoint {
  t: number
  lat: number
  lon: number
  alt?: number | null
  /** Active (non-paused) time in ms since start */
  at: number
  /** Cumulative distance in meters */
  d: number
  /** Segment number; a new segment starts after every pause */
  seg: number
}

export type TrackerEvent =
  | { type: 'split'; split: Split }
  | { type: 'marker'; n: number }
  | { type: 'autopause' }
  | { type: 'autoresume' }

export interface TrackerOptions {
  /** Distance of recorded splits (one unit) */
  splitMeters: number
  /** Distance between voice announcements, or null for none */
  markerMeters: number | null
  autoPause: boolean
}

const SPEED_WINDOW_MS = 10_000
const MIN_SPEED_SPAN_MS = 3_000
/** With auto-pause on, no usable fix for this long counts as stopped. */
const STALE_FIX_MS = 15_000

/** Turns a stream of GPS fixes into distance, active time, splits and pause state. */
export class Tracker {
  readonly points: TrackPoint[] = []
  readonly splits: SplitTracker
  pausedBy: 'user' | 'auto' | null = null
  private readonly markers: SplitTracker | null
  private readonly filter = new FixFilter()
  private readonly auto: AutoPause | null
  private recent: Fix[] = []
  private activeMs = 0
  private resumedAt: number
  private lastFixT: number
  private newSegment = true

  constructor(readonly startT: number, opts: TrackerOptions) {
    this.splits = new SplitTracker(opts.splitMeters)
    this.markers = opts.markerMeters ? new SplitTracker(opts.markerMeters) : null
    this.auto = opts.autoPause ? new AutoPause() : null
    this.resumedAt = startT
    this.lastFixT = startT
  }

  get paused(): boolean {
    return this.pausedBy !== null
  }

  get distance(): number {
    return this.points.at(-1)?.d ?? 0
  }

  /** Active (non-paused) time in ms. */
  elapsed(now: number): number {
    return this.activeMs + (this.paused ? 0 : Math.max(0, now - this.resumedAt))
  }

  /** Current rolling pace in s/km. */
  pace(): number | null {
    return rollingPace(this.points)
  }

  pause(now: number, by: 'user' | 'auto' = 'user') {
    if (this.paused) {
      // A manual pause during auto-pause takes over, so moving again won't auto-resume.
      if (by === 'user') this.pausedBy = 'user'
      return
    }
    this.activeMs = this.elapsed(now)
    this.pausedBy = by
    this.newSegment = true
    this.auto?.set(true)
  }

  resume(now: number) {
    if (!this.paused) return
    this.pausedBy = null
    this.resumedAt = now
    this.auto?.set(false)
  }

  addFix(fix: Fix): TrackerEvent[] {
    if (!this.filter.accept(fix)) return []
    this.lastFixT = fix.t
    this.recent.push(fix)
    while (this.recent[0].t < fix.t - SPEED_WINDOW_MS) this.recent.shift()

    const events: TrackerEvent[] = []
    if (this.auto && this.pausedBy !== 'user') {
      const speed = this.speed()
      const change = speed == null ? null : this.auto.update(fix.t, speed)
      if (change === 'pause') {
        this.pause(fix.t, 'auto')
        events.push({ type: 'autopause' })
      } else if (change === 'resume') {
        this.resume(fix.t)
        events.push({ type: 'autoresume' })
      }
    }
    if (this.paused) return events

    const at = this.elapsed(fix.t)
    const last = this.points.at(-1)
    const base = { t: fix.t, lat: fix.lat, lon: fix.lon, alt: fix.alt ?? null, at }
    if (!last || this.newSegment) {
      this.points.push({ ...base, d: last?.d ?? 0, seg: last ? last.seg + 1 : 0 })
      this.newSegment = false
      return events
    }
    const point = { ...base, d: last.d + haversine(last, fix), seg: last.seg }
    this.points.push(point)
    for (const split of this.splits.update(last, point)) events.push({ type: 'split', split })
    for (const m of this.markers?.update(last, point) ?? []) events.push({ type: 'marker', n: m.index })
    return events
  }

  /** Call periodically; auto-pauses if GPS has gone quiet. */
  tick(now: number): TrackerEvent[] {
    if (this.auto && !this.paused && now - this.lastFixT > STALE_FIX_MS) {
      this.pause(now, 'auto')
      return [{ type: 'autopause' }]
    }
    return []
  }

  /** All splits including the unfinished last one. */
  allSplits(): Split[] {
    const last = this.points.at(-1)
    const partial = last ? this.splits.partial(last) : null
    return partial ? [...this.splits.splits, partial] : [...this.splits.splits]
  }

  /** Ground speed in m/s, preferring the device's Doppler speed over position deltas. */
  private speed(): number | null {
    const latest = this.recent[this.recent.length - 1]
    if (latest.speed != null && latest.speed >= 0) return latest.speed
    const first = this.recent[0]
    const dt = latest.t - first.t
    if (dt < MIN_SPEED_SPAN_MS) return null
    return haversine(first, latest) / (dt / 1000)
  }
}
