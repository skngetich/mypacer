import { registerPlugin } from '@capacitor/core'
import { QueueStrategy, TextToSpeech } from '@capacitor-community/text-to-speech'
import { isNative } from './platform'

/** App-local Android plugin (AudioFocusPlugin.java) that ducks music while we speak. */
const AudioFocus = registerPlugin<{ duck(): Promise<void>; release(): Promise<void> }>('AudioFocus')

const synth: SpeechSynthesis | null = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null

export const speechSupported = isNative || synth != null

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
  if (isNative || !synth) return
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  synth.speak(u)
}

/** Utterances queued in the native engine; music stays ducked until this drops to 0. */
let nativePending = 0

function sayNative(text: string, interrupt: boolean) {
  nativePending++
  void AudioFocus.duck().catch(() => {})
  TextToSpeech.speak({
    text,
    rate,
    lang: navigator.language,
    queueStrategy: interrupt ? QueueStrategy.Flush : QueueStrategy.Add,
  })
    .catch(() => {})
    .finally(() => {
      if (--nativePending === 0) void AudioFocus.release().catch(() => {})
    })
}

/** Queue text; `interrupt` drops anything still waiting so the answer is current. */
export function say(text: string, { interrupt = false } = {}) {
  spokenLog.push(text)
  if (isNative) return sayNative(text, interrupt)
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
