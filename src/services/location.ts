import type { Fix } from '../core/geo'
import { routeFixes, type Leg } from '../core/simroute'

export interface LocationSource {
  readonly simulated: boolean
  /** Clock that matches fix timestamps */
  now(): number
  start(onFix: (fix: Fix) => void, onError: (message: string, fatal: boolean) => void): void
  stop(): void
}

export class GeolocationSource implements LocationSource {
  readonly simulated = false
  private watchId: number | null = null

  now() {
    return Date.now()
  }

  start(onFix: (fix: Fix) => void, onError: (message: string, fatal: boolean) => void) {
    if (!('geolocation' in navigator)) {
      onError('This browser has no GPS access.', true)
      return
    }
    this.watchId = navigator.geolocation.watchPosition(
      (p) =>
        onFix({
          // Some iOS versions report bogus position timestamps; the wall clock is reliable.
          t: Date.now(),
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          acc: p.coords.accuracy,
          alt: p.coords.altitude,
          speed: p.coords.speed,
        }),
      (e) => {
        const denied = e.code === e.PERMISSION_DENIED
        onError(denied ? 'Location permission denied. Enable it in your browser settings.' : e.message, denied)
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    )
  }

  stop() {
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId)
    this.watchId = null
  }
}

/** Warm-up, steady run, a traffic-light stop, a surge and a GPS glitch. */
const SIM_LEGS: Leg[] = [
  { durationS: 120, pace: 390 },
  { durationS: 240, pace: 330 },
  { durationS: 25, pace: null },
  { durationS: 180, pace: 300 },
  { durationS: 120, pace: 270 },
  { durationS: 3600, pace: 330 },
]

/** Replays a fake route, optionally faster than real time. Enabled with ?sim or ?sim=<speedup>. */
export class SimulatedSource implements LocationSource {
  readonly simulated = true
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly t0 = Date.now()

  constructor(private readonly speedup = 1) {}

  now() {
    return this.t0 + (Date.now() - this.t0) * this.speedup
  }

  start(onFix: (fix: Fix) => void) {
    const fixes = routeFixes(SIM_LEGS, { t0: this.now(), noiseM: 0.5, spikesAt: [200], withSpeed: true, loopRadiusM: 250 })
    this.timer = setInterval(() => {
      const next = fixes.next()
      if (!next.done) onFix(next.value)
    }, 1000 / this.speedup)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}

export function simSpeedup(): number | null {
  const q = new URLSearchParams(location.search).get('sim') ?? new URLSearchParams(location.hash.split('?')[1]).get('sim')
  if (q == null) return null
  const n = Number(q)
  return n > 0 ? n : 1
}

export function createSource(): LocationSource {
  const speedup = simSpeedup()
  return speedup ? new SimulatedSource(speedup) : new GeolocationSource()
}
