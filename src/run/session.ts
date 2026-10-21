import { reactive } from 'vue'
import { Announcer, type Snapshot } from '../core/announcer'
import type { Fix } from '../core/geo'
import { averagePace } from '../core/pace'
import type { RunRecord } from '../core/run'
import type { Split } from '../core/splits'
import { Tracker, type TrackerEvent } from '../core/tracker'
import { METERS_PER, paceInUnit, type Unit } from '../core/units'
import { clearCurrent, saveCurrent, saveRun } from '../services/db'
import { createSource, type LocationSource } from '../services/location'
import { isNative } from '../services/platform'
import { settings } from '../services/settings'
import { say, setRate, unlockSpeech } from '../services/speech'
import { allowSleep, keepAwake } from '../services/wakelock'

export type Phase = 'idle' | 'acquiring' | 'running' | 'paused'

/** Accuracy (m) required before the run starts */
const READY_ACCURACY_M = 20
const TICK_MS = 1000
const AUTOSAVE_MS = 10_000
/** Hidden longer than this means we probably missed GPS fixes */
const GAP_NOTICE_MS = 5000

export const session = reactive({
  phase: 'idle' as Phase,
  unit: 'km' as Unit,
  simulated: false,
  /** Active time in ms */
  elapsed: 0,
  distance: 0,
  /** Current pace, s/km */
  pace: null as number | null,
  avgPace: null as number | null,
  splits: [] as Split[],
  autoPaused: false,
  gpsAccuracy: null as number | null,
  error: '',
  lastSpoken: '',
  gapNotice: false,
})

let source: LocationSource | null = null
let tracker: Tracker | null = null
let announcer: Announcer | null = null
let startedAt = 0
let runId = ''
let tickTimer: ReturnType<typeof setInterval> | null = null
let saveTimer: ReturnType<typeof setInterval> | null = null
let hiddenAt: number | null = null

function speak(text: string, interrupt = false) {
  session.lastSpoken = text
  setRate(settings.voiceRate)
  say(text, { interrupt })
}

function snapshot(): Snapshot {
  return {
    at: session.elapsed,
    pace: session.pace == null ? null : paceInUnit(session.pace, session.unit),
    paused: session.phase === 'paused',
  }
}

function refresh() {
  if (!tracker || !source) return
  session.elapsed = tracker.elapsed(source.now())
  session.distance = tracker.distance
  session.pace = tracker.paused ? null : tracker.pace()
  session.avgPace = averagePace(session.elapsed, session.distance)
  session.phase = tracker.paused ? 'paused' : 'running'
  session.autoPaused = tracker.pausedBy === 'auto'
}

function handle(events: TrackerEvent[]) {
  refresh()
  for (const e of events) {
    if (e.type === 'split') session.splits.push(e.split)
    else if (e.type === 'marker') speak(announcer!.marker(e.n, snapshot()))
    else if (e.type === 'autopause') speak('Auto paused.')
    else if (e.type === 'autoresume') speak('Resumed.')
  }
}

function onFix(fix: Fix) {
  session.gpsAccuracy = fix.acc
  if (session.phase === 'acquiring') {
    if (fix.acc > READY_ACCURACY_M) return
    begin(fix.t)
  }
  if (!tracker) return
  handle(tracker.addFix(fix))
  // Timers are throttled while the phone is locked; GPS updates keep time and target announcements on schedule.
  announce()
}

function onError(message: string, fatal: boolean) {
  session.error = message
  if (fatal) reset()
}

function begin(t: number) {
  startedAt = t
  runId = `run-${t}`
  session.unit = settings.unit
  tracker = new Tracker(t, {
    splitMeters: METERS_PER[settings.unit],
    markerMeters: settings.splitDistance > 0 ? settings.splitDistance * METERS_PER[settings.unit] : null,
    autoPause: settings.autoPause,
  })
  // Unit and marker distance are fixed for the run; interval and target can change live.
  const { splitDistance } = settings
  announcer = new Announcer(() => ({ ...settings, unit: session.unit, splitDistance }))
  session.phase = 'running'
  session.error = ''
  speak('GPS ready. Go!')
  tickTimer = setInterval(tick, TICK_MS)
  saveTimer = setInterval(() => void saveCurrent(record()), AUTOSAVE_MS)
}

function announce() {
  for (const text of announcer!.tick(snapshot())) speak(text)
}

function tick() {
  if (!tracker || !source) return
  handle(tracker.tick(source.now()))
  announce()
}

function record(): RunRecord {
  const now = source!.now()
  return {
    id: runId,
    startedAt,
    endedAt: now,
    distance: tracker!.distance,
    activeMs: tracker!.elapsed(now),
    unit: session.unit,
    points: tracker!.points.map((p) => ({ ...p })),
    splits: tracker!.allSplits(),
  }
}

function reset() {
  source?.stop()
  if (tickTimer) clearInterval(tickTimer)
  if (saveTimer) clearInterval(saveTimer)
  source = tracker = announcer = null
  tickTimer = saveTimer = null
  allowSleep()
  Object.assign(session, {
    phase: 'idle',
    elapsed: 0,
    distance: 0,
    pace: null,
    avgPace: null,
    splits: [],
    autoPaused: false,
    gpsAccuracy: null,
    gapNotice: false,
  })
}

/** Must be called from a tap so iOS allows speech. */
export function start() {
  if (session.phase !== 'idle') return
  unlockSpeech()
  keepAwake()
  source = createSource()
  session.simulated = source.simulated
  session.error = ''
  session.phase = 'acquiring'
  speak('Waiting for GPS.')
  source.start(onFix, onError)
}

export function pause() {
  if (!tracker || !source) return
  tracker.pause(source.now())
  refresh()
  speak('Paused.', true)
}

export function resume() {
  if (!tracker || !source) return
  tracker.resume(source.now())
  refresh()
  speak('Resumed.', true)
}

/** Ends the run and saves it. Returns the saved run's id, or null if nothing was recorded. */
export async function stop(): Promise<string | null> {
  if (!tracker || tracker.points.length < 2) {
    reset()
    await clearCurrent()
    speak('Run discarded.', true)
    return null
  }
  const run = record()
  reset()
  await saveRun(run)
  await clearCurrent()
  speak('Run saved.', true)
  return run.id
}

export function announceNow() {
  if (!announcer) {
    speak(session.phase === 'acquiring' ? 'Still waiting for GPS.' : 'Not running.', true)
    return
  }
  speak(announcer.onDemand(snapshot()), true)
}

document.addEventListener('visibilitychange', () => {
  // The native app keeps tracking in the background, so there's no gap to warn about.
  if (isNative || session.phase === 'idle') return
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now()
  } else if (hiddenAt != null) {
    if (Date.now() - hiddenAt > GAP_NOTICE_MS) session.gapNotice = true
    hiddenAt = null
  }
})
