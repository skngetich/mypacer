import { isNative } from './platform'

// The native app tracks with the screen off, so it never needs to hold the screen on.
export const wakeLockSupported = !isNative && typeof navigator !== 'undefined' && 'wakeLock' in navigator

let sentinel: WakeLockSentinel | null = null
let wanted = false

async function acquire() {
  if (!wakeLockSupported || sentinel) return
  try {
    sentinel = await navigator.wakeLock.request('screen')
    sentinel.addEventListener('release', () => (sentinel = null))
  } catch {
    // Denied (e.g. low battery); nothing else to do.
  }
}

/** The lock is dropped whenever the page is hidden, so take it again on return. */
document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible') void acquire()
})

export function keepAwake() {
  wanted = true
  void acquire()
}

export function allowSleep() {
  wanted = false
  void sentinel?.release()
  sentinel = null
}
