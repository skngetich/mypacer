import { describe, expect, it } from 'vitest'
import { Announcer, type AnnouncerSettings } from './announcer'
import { AutoPause } from './autopause'
import { FixFilter, haversine } from './geo'
import { toGpx } from './gpx'
import { formatDuration, formatPace, paceToSpeech, rollingPace } from './pace'
import { routeFixes, type Leg } from './simroute'
import { SplitTracker } from './splits'
import { Tracker, type TrackerEvent } from './tracker'
import { convertPace, paceInUnit } from './units'

function runTrack(legs: Leg[], opts: Partial<ConstructorParameters<typeof Tracker>[1]> = {}, route = {}) {
  const tracker = new Tracker(0, { splitMeters: 1000, markerMeters: null, autoPause: false, ...opts })
  const events: TrackerEvent[] = []
  let lastT = 0
  for (const fix of routeFixes(legs, route)) {
    events.push(...tracker.addFix(fix), ...tracker.tick(fix.t))
    lastT = fix.t
  }
  return { tracker, events, lastT }
}

describe('geo', () => {
  it('measures ~111 km per degree of latitude', () => {
    expect(haversine({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111_195, -2)
  })

  it('rejects inaccurate fixes and single jumps but recovers after repeated ones', () => {
    const f = new FixFilter()
    expect(f.accept({ t: 0, lat: 0, lon: 0, acc: 5 })).toBe(true)
    expect(f.accept({ t: 1000, lat: 0, lon: 0, acc: 50 })).toBe(false)
    const far = { lat: 0.01, lon: 0, acc: 5 } // ~1.1 km away
    expect(f.accept({ t: 1000, ...far })).toBe(false)
    expect(f.accept({ t: 2000, ...far })).toBe(false)
    expect(f.accept({ t: 3000, ...far })).toBe(false)
    expect(f.accept({ t: 4000, ...far })).toBe(true)
  })
})

describe('pace formatting', () => {
  it('formats and speaks paces', () => {
    expect(formatPace(342)).toBe('5:42')
    expect(formatPace(null)).toBe('--:--')
    expect(formatPace(4000)).toBe('--:--')
    expect(paceToSpeech(342)).toBe('5 42')
    expect(paceToSpeech(307)).toBe('5 oh 7')
    expect(paceToSpeech(360)).toBe('6 flat')
    expect(formatDuration(3_725_000)).toBe('1:02:05')
    expect(formatDuration(65_000)).toBe('1:05')
  })

  it('converts between units', () => {
    expect(paceInUnit(300, 'mi')).toBeCloseTo(482.8, 1)
    expect(convertPace(482.8032, 'mi', 'km')).toBeCloseTo(300, 3)
  })

  it('computes rolling pace only from the last 30s', () => {
    const samples = [
      { at: 0, d: 0 },
      { at: 60_000, d: 100 }, // very slow first minute
      { at: 75_000, d: 150 },
      { at: 90_000, d: 200 }, // last 30s: 100 m in 30 s -> 300 s/km
    ]
    expect(rollingPace(samples)).toBeCloseTo(300)
    expect(rollingPace(samples.slice(0, 1))).toBeNull()
  })
})

describe('splits', () => {
  it('interpolates boundary crossings', () => {
    const s = new SplitTracker(1000)
    expect(s.update({ at: 0, d: 0 }, { at: 200_000, d: 900 })).toEqual([])
    const crossed = s.update({ at: 200_000, d: 900 }, { at: 300_000, d: 1100 })
    expect(crossed).toHaveLength(1)
    expect(crossed[0].durationMs).toBeCloseTo(250_000)
    expect(s.partial({ at: 300_000, d: 1100 })).toMatchObject({ index: 2, distance: 100 })
  })

  it('handles several crossings in one step', () => {
    const s = new SplitTracker(100)
    expect(s.update({ at: 0, d: 0 }, { at: 30_000, d: 300 })).toHaveLength(3)
  })
})

describe('tracker', () => {
  it('tracks a steady 5:00/km run', () => {
    const { tracker, events, lastT } = runTrack([{ durationS: 660, pace: 300 }], { markerMeters: 500 }, { noiseM: 1 })
    expect(tracker.distance).toBeGreaterThan(2150)
    expect(tracker.distance).toBeLessThan(2350)
    expect(tracker.pace()).toBeGreaterThan(270)
    expect(tracker.pace()).toBeLessThan(310)
    expect(tracker.elapsed(lastT)).toBe(lastT)
    expect(events.filter((e) => e.type === 'split')).toHaveLength(2)
    expect(events.filter((e) => e.type === 'marker').map((e) => (e as { n: number }).n)).toEqual([1, 2, 3, 4])
  })

  it('reflects a change of pace within the rolling window', () => {
    const { tracker } = runTrack([
      { durationS: 300, pace: 360 },
      { durationS: 60, pace: 240 },
    ])
    expect(tracker.pace()).toBeCloseTo(240, 0)
  })

  it('keeps current pace steady on a noisy track when the device reports speed', () => {
    const spread = (withSpeed: boolean) => {
      const tracker = new Tracker(0, { splitMeters: 1000, markerMeters: null, autoPause: false })
      const paces: number[] = []
      for (const fix of routeFixes([{ durationS: 300, pace: 300 }], { noiseM: 4, withSpeed })) {
        tracker.addFix(fix)
        if (fix.t >= 60_000) paces.push(tracker.pace()!)
      }
      return Math.max(...paces) - Math.min(...paces)
    }
    expect(spread(true)).toBeLessThan(1)
    expect(spread(false)).toBeGreaterThan(10) // position-only pace is what felt jumpy
  })

  it('falls back to distance over time when speed is missing', () => {
    const samples = [
      { at: 0, d: 0, v: 3 },
      { at: 15_000, d: 50, v: null },
      { at: 30_000, d: 100, v: null },
    ]
    expect(rollingPace(samples)).toBeCloseTo(300)
  })

  it('ignores a GPS spike', () => {
    const { tracker } = runTrack([{ durationS: 300, pace: 300 }], {}, { spikesAt: [100] })
    expect(tracker.distance).toBeCloseTo(1000, -1)
  })

  it('auto-pauses at a stop and excludes the stop from time and distance', () => {
    const { tracker, events, lastT } = runTrack(
      [
        { durationS: 120, pace: 300 },
        { durationS: 60, pace: null },
        { durationS: 120, pace: 300 },
      ],
      { autoPause: true },
      { noiseM: 1, withSpeed: true },
    )
    expect(events.map((e) => e.type)).toEqual(['autopause', 'autoresume'])
    const active = tracker.elapsed(lastT)
    expect(active).toBeGreaterThan(240_000)
    expect(active).toBeLessThan(255_000)
    expect(tracker.distance).toBeGreaterThan(780)
    expect(tracker.distance).toBeLessThan(830)
    expect(new Set(tracker.points.map((p) => p.seg))).toEqual(new Set([0, 1]))
  })

  it('auto-pauses when fixes stop arriving', () => {
    const tracker = new Tracker(0, { splitMeters: 1000, markerMeters: null, autoPause: true })
    for (const fix of routeFixes([{ durationS: 30, pace: 300 }])) tracker.addFix(fix)
    expect(tracker.tick(40_000)).toEqual([])
    expect(tracker.tick(46_000)).toEqual([{ type: 'autopause' }])
  })

  it('does not auto-resume after a manual pause', () => {
    const tracker = new Tracker(0, { splitMeters: 1000, markerMeters: null, autoPause: true })
    const fixes = [...routeFixes([{ durationS: 60, pace: 300 }], { withSpeed: true })]
    fixes.slice(0, 20).forEach((f) => tracker.addFix(f))
    tracker.pause(20_000)
    const events = fixes.slice(20).flatMap((f) => tracker.addFix(f))
    expect(events).toEqual([])
    expect(tracker.pausedBy).toBe('user')
    expect(tracker.elapsed(60_000)).toBe(20_000)
  })
})

describe('autopause hysteresis', () => {
  it('needs a sustained stop and a sustained start', () => {
    const ap = new AutoPause()
    expect(ap.update(0, 0.2)).toBeNull()
    expect(ap.update(3000, 2)).toBeNull() // moved again: timer resets
    expect(ap.update(4000, 0.2)).toBeNull()
    expect(ap.update(9000, 0.2)).toBe('pause')
    expect(ap.update(10_000, 1.0)).toBeNull() // below resume threshold
    expect(ap.update(11_000, 2)).toBeNull()
    expect(ap.update(13_000, 2)).toBe('resume')
  })
})

describe('announcer', () => {
  const base: AnnouncerSettings = { unit: 'km', splitDistance: 1, intervalMin: 0, targetEnabled: false, targetPace: 330, tolerance: 10 }
  const make = (o: Partial<AnnouncerSettings> = {}) => new Announcer(() => ({ ...base, ...o }))

  it('announces distance markers with current pace', () => {
    expect(make().marker(3, { at: 1, pace: 342, paused: false })).toBe('3 kilometers. Pace 5 42.')
    expect(make({ unit: 'mi', splitDistance: 0.5 }).marker(2, { at: 1, pace: 500, paused: false })).toBe('1 mile. Pace 8 20.')
  })

  it('announces time intervals once each', () => {
    const a = make({ intervalMin: 5 })
    const said: string[] = []
    for (let at = 0; at <= 11 * 60_000; at += 1000) said.push(...a.tick({ at, pace: 300, paused: false }))
    expect(said).toEqual(['5 minutes. Pace 5 flat.', '10 minutes. Pace 5 flat.'])
  })

  it('skips a time announcement right after a distance one', () => {
    const a = make({ intervalMin: 5 })
    a.marker(1, { at: 296_000, pace: 300, paused: false })
    expect(a.tick({ at: 300_000, pace: 300, paused: false })).toEqual([])
  })

  it('alerts off-target with grace period and cooldown', () => {
    const a = make({ targetEnabled: true })
    const slow = (at: number) => a.tick({ at, pace: 360, paused: false })
    expect(slow(30_000)).toEqual([]) // grace
    expect(slow(60_000)).toEqual(['Speed up. Pace 6 flat.'])
    expect(slow(80_000)).toEqual([]) // cooldown
    expect(slow(90_000)).toEqual(['Speed up. Pace 6 flat.'])
    expect(a.tick({ at: 95_000, pace: 335, paused: false })).toEqual(['Back on target.'])
    expect(a.tick({ at: 96_000, pace: 335, paused: false })).toEqual([])
    expect(a.tick({ at: 130_000, pace: 300, paused: false })).toEqual(['Slow down. Pace 5 flat.'])
    expect(a.tick({ at: 170_000, pace: 300, paused: true })).toEqual([])
  })

  it('does not repeat the pace in an alert right after an announcement', () => {
    const a = make({ targetEnabled: true, intervalMin: 2 })
    expect(a.tick({ at: 120_000, pace: 360, paused: false })).toEqual(['2 minutes. Pace 6 flat.', 'Speed up.'])
  })

  it('answers on demand', () => {
    expect(make().onDemand({ at: 0, pace: null, paused: false })).toBe('Pace not available yet.')
  })
})

describe('gpx', () => {
  it('writes one trkseg per segment', () => {
    const { tracker, lastT } = runTrack(
      [
        { durationS: 60, pace: 300 },
        { durationS: 30, pace: null },
        { durationS: 60, pace: 300 },
      ],
      { autoPause: true },
      { withSpeed: true },
    )
    const gpx = toGpx({
      id: 'x',
      startedAt: 0,
      endedAt: lastT,
      distance: tracker.distance,
      activeMs: tracker.elapsed(lastT),
      unit: 'km',
      points: tracker.points,
      splits: tracker.allSplits(),
    })
    expect(gpx.match(/<trkseg>/g)).toHaveLength(2)
    expect(gpx.match(/<trkpt /g)!.length).toBe(tracker.points.length)
    expect(gpx).toContain('<time>1970-01-01T00:00:00.000Z</time>')
  })
})
