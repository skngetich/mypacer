import { paceInUnit, toUnit, type Unit } from './units'

/** A point on the run: active (non-paused) time in ms and cumulative distance in meters. */
export interface Sample {
  at: number
  d: number
  /** Device-reported (Doppler) speed in m/s, if available */
  v?: number | null
}

export const PACE_WINDOW_MS = 30_000
const MIN_WINDOW_MS = 10_000
const MIN_WINDOW_M = 10
/** Share of samples in the window that must carry a device speed to use it. */
const MIN_SPEED_COVERAGE = 0.8
/** Below this average speed (m/s) the runner is effectively stopped. */
const MIN_MOVING_SPEED = 0.3

/**
 * Rolling pace over the last `windowMs` of active time, in seconds per km. Null if not enough data.
 * Prefers the average device speed, which is far steadier than differencing jittery positions.
 */
export function rollingPace(samples: readonly Sample[], windowMs = PACE_WINDOW_MS): number | null {
  if (samples.length < 2) return null
  const last = samples[samples.length - 1]
  let i = samples.length - 1
  while (i > 0 && samples[i - 1].at >= last.at - windowMs) i--
  const first = samples[i]
  const dt = last.at - first.at
  if (dt < MIN_WINDOW_MS) return null

  const speeds = samples.slice(i).flatMap((s) => (s.v != null && s.v >= 0 ? [s.v] : []))
  if (speeds.length >= MIN_SPEED_COVERAGE * (samples.length - i)) {
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length
    return mean < MIN_MOVING_SPEED ? null : 1000 / mean
  }

  const dd = last.d - first.d
  if (dd < MIN_WINDOW_M) return null
  return dt / dd // ms per m == s per km
}

/** Average pace in seconds per km. */
export function averagePace(activeMs: number, meters: number): number | null {
  if (meters < MIN_WINDOW_M || activeMs <= 0) return null
  return activeMs / meters
}

/** Paces slower than this are shown as "--:--". */
const MAX_DISPLAY_PACE_S = 60 * 60

// Paces are truncated like durations, so a 1 km split of 5:34.6 shows 5:34 for both.
export function formatPace(secPerUnit: number | null): string {
  if (secPerUnit == null || !isFinite(secPerUnit) || secPerUnit >= MAX_DISPLAY_PACE_S) return '--:--'
  const total = Math.floor(secPerUnit)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** "5 42", "5 oh 7", "6 flat": how runners say a pace. */
export function paceToSpeech(secPerUnit: number): string {
  const total = Math.floor(secPerUnit)
  const m = Math.floor(total / 60)
  const s = total % 60
  if (s === 0) return `${m} flat`
  if (s < 10) return `${m} oh ${s}`
  return `${m} ${s}`
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function formatDistance(meters: number, unit: Unit): string {
  return toUnit(meters, unit).toFixed(2)
}

/** Pace (s/km) to "m:ss" in the given unit. */
export function displayPace(secPerKm: number | null, unit: Unit): string {
  return formatPace(secPerKm == null ? null : paceInUnit(secPerKm, unit))
}
