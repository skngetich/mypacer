import type { Split } from './splits'
import type { TrackPoint } from './tracker'
import type { Unit } from './units'

export interface RunRecord {
  id: string
  startedAt: number
  endedAt: number
  /** Meters */
  distance: number
  activeMs: number
  /** Unit the splits were recorded in */
  unit: Unit
  points: TrackPoint[]
  splits: Split[]
}
