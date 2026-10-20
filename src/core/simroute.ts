import type { Fix } from './geo'

export interface Leg {
  durationS: number
  /** Seconds per km, or null to stand still */
  pace: number | null
}

export interface RouteOptions {
  lat?: number
  lon?: number
  t0?: number
  intervalMs?: number
  /** Max random position error in meters */
  noiseM?: number
  /** Seconds after start at which to emit a single wildly-off fix */
  spikesAt?: number[]
  /** Report device speed (m/s) like real phones do */
  withSpeed?: boolean
  /** Run laps of a circle with this radius instead of heading north */
  loopRadiusM?: number
  rand?: () => number
}

const M_PER_DEG_LAT = 111_320

/** Generates fixes for a runner heading north following `legs`. */
export function* routeFixes(legs: Leg[], opts: RouteOptions = {}): Generator<Fix> {
  const { lat = 51.5, lon = -0.12, t0 = 0, intervalMs = 1000, noiseM = 0, spikesAt = [], withSpeed = false, loopRadiusM, rand = Math.random } = opts
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)
  /** Position in meters (east, north) after travelling `d` meters */
  const at = (d: number): [number, number] => {
    if (!loopRadiusM) return [0, d]
    const angle = d / loopRadiusM
    return [loopRadiusM * Math.sin(angle), loopRadiusM * (1 - Math.cos(angle))]
  }
  let travelled = 0
  let t = t0
  let elapsedS = 0
  for (const leg of legs) {
    const speed = leg.pace ? 1000 / leg.pace : 0
    for (let i = 0; i < (leg.durationS * 1000) / intervalMs; i++) {
      const jitter = () => (rand() * 2 - 1) * noiseM
      const spike = spikesAt.some((s) => Math.abs(s - elapsedS) < intervalMs / 2000) ? 500 : 0
      const [east, north] = at(travelled)
      yield {
        t,
        lat: lat + (north + jitter() + spike) / M_PER_DEG_LAT,
        lon: lon + (east + jitter() + spike) / mPerDegLon,
        acc: 5,
        alt: 20,
        speed: withSpeed ? speed : null,
      }
      travelled += (speed * intervalMs) / 1000
      t += intervalMs
      elapsedS += intervalMs / 1000
    }
  }
}
