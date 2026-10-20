const synth: SpeechSynthesis | null = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null

export const speechSupported = synth != null

/** Everything spoken this session, newest last (handy for debugging and tests). */
export const spokenLog: string[] = []
;(globalThis as { __spoken?: string[] }).__spoken = spokenLog

let rate = 1

export function setRate(r: number) {
  rate = r
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = synth?.getVoices() ?? []
  const lang = navigator.language
  return voices.find((v) => v.lang === lang && v.localService) ?? voices.find((v) => v.lang.startsWith('en') && v.localService)
}

/** iOS only lets a page speak after speech starts inside a user gesture, so call this from a tap. */
export function unlockSpeech() {
  if (!synth) return
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  synth.speak(u)
}

/** Queue text; `interrupt` drops anything still waiting so the answer is current. */
export function say(text: string, { interrupt = false } = {}) {
  spokenLog.push(text)
  if (!synth) return
  if (interrupt) synth.cancel()
  // Chrome can get stuck in a paused state after the tab was backgrounded.
  synth.resume()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = rate
  const voice = pickVoice()
  if (voice) u.voice = voice
  synth.speak(u)
}
