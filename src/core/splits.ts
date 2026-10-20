import type { Sample } from './pace'

export interface Split {
  /** 1-based split number */
  index: number
  /** Split length in meters (the last split of a run may be shorter) */
  distance: number
  durationMs: number
}

/** Detects when cumulative distance crosses each multiple of `splitMeters`, interpolating the crossing time. */
export class SplitTracker {
  readonly splits: Split[] = []
  private next: number
  private lastBoundaryAt = 0
  private lastBoundaryD = 0

  constructor(readonly splitMeters: number) {
    this.next = splitMeters
  }

  update(prev: Sample, cur: Sample): Split[] {
    const crossed: Split[] = []
    while (cur.d >= this.next && cur.d > prev.d) {
      const frac = (this.next - prev.d) / (cur.d - prev.d)
      const at = prev.at + frac * (cur.at - prev.at)
      const split = { index: this.splits.length + 1, distance: this.splitMeters, durationMs: at - this.lastBoundaryAt }
      this.splits.push(split)
      crossed.push(split)
      this.lastBoundaryAt = at
      this.lastBoundaryD = this.next
      this.next += this.splitMeters
    }
    return crossed
  }

  /** The unfinished split after the last boundary, or null if it's too short to matter. */
  partial(last: Sample, minMeters = 50): Split | null {
    const distance = last.d - this.lastBoundaryD
    if (distance < minMeters) return null
    return { index: this.splits.length + 1, distance, durationMs: last.at - this.lastBoundaryAt }
  }
}
