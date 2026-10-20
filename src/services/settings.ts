import { reactive, watch } from 'vue'
import type { AnnouncerSettings } from '../core/announcer'

export interface Settings extends AnnouncerSettings {
  autoPause: boolean
  voiceRate: number
}

const KEY = 'mypacer.settings'

const DEFAULTS: Settings = {
  unit: 'km',
  splitDistance: 1,
  intervalMin: 0,
  targetEnabled: false,
  targetPace: 330,
  tolerance: 10,
  autoPause: true,
  voiceRate: 1,
}

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export const settings = reactive<Settings>(load())

watch(
  settings,
  (s) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      // Storage unavailable (private mode); settings last for this session only.
    }
  },
  { deep: true },
)
