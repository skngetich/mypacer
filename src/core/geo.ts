export interface Fix {
  /** Timestamp in ms */
  t: number
  lat: number
  lon: number
  /** Horizontal accuracy in meters */
  acc: number
  alt?: number | null
  /** Device-reported ground speed in m/s, if available */
  speed?: number | null
}

const EARTH_RADIUS_M = 6371008.8
const rad = (deg: number) => (deg * Math.PI) / 180

export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const MAX_ACCURACY_M = 25
export const MAX_SPEED_MPS = 10
/** After this many consecutive speed rejections, trust the new position (we were probably wrong before). */
const MAX_CONSECUTIVE_REJECTS = 3

/** Drops inaccurate fixes and implausible jumps. */
export class FixFilter {
  private last: Fix | null = null
  private rejects = 0

  accept(fix: Fix): boolean {
    if (fix.acc > MAX_ACCURACY_M) return false
    if (this.last) {
      const dt = (fix.t - this.last.t) / 1000
      if (dt <= 0) return false
      const speed = haversine(this.last, fix) / dt
      if (speed > MAX_SPEED_MPS && this.rejects < MAX_CONSECUTIVE_REJECTS) {
        this.rejects++
        return false
      }
    }
    this.rejects = 0
    this.last = fix
    return true
  }
}
