<script setup lang="ts">
import { computed } from 'vue'
import { formatPace } from '../core/pace'
import { convertPace, type Unit } from '../core/units'
import { session } from '../run/session'
import { settings } from '../services/settings'
import { say, setRate, unlockSpeech } from '../services/speech'

const running = computed(() => session.phase !== 'idle')

function setUnit(unit: Unit) {
  if (unit === settings.unit) return
  settings.targetPace = Math.round(convertPace(settings.targetPace, settings.unit, unit))
  settings.unit = unit
}

const targetText = computed({
  get: () => formatPace(settings.targetPace),
  set: (v: string) => {
    const m = /^(\d{1,2}):([0-5]\d)$/.exec(v.trim())
    if (m) settings.targetPace = Number(m[1]) * 60 + Number(m[2])
  },
})

function testVoice() {
  unlockSpeech()
  setRate(settings.voiceRate)
  say('Pace 5 42.', { interrupt: true })
}

const isIos = /iP(hone|ad|od)/.test(navigator.userAgent)
const standalone = window.matchMedia('(display-mode: standalone)').matches
</script>

<template>
  <h1>Settings</h1>

  <div class="card">
    <label class="field">
      <span>Units</span>
      <div class="seg">
        <button :class="{ on: settings.unit === 'km' }" :disabled="running" @click="setUnit('km')">km</button>
        <button :class="{ on: settings.unit === 'mi' }" :disabled="running" @click="setUnit('mi')">miles</button>
      </div>
    </label>
    <p v-if="running" class="muted small">Units, distance announcements and auto-pause can't change during a run.</p>
  </div>

  <div class="card">
    <h2>Voice announcements</h2>
    <label class="field">
      <span>Every distance</span>
      <select v-model.number="settings.splitDistance" :disabled="running">
        <option :value="0">Off</option>
        <option v-for="d in [0.25, 0.5, 1, 2, 5]" :key="d" :value="d">{{ d }} {{ settings.unit }}</option>
      </select>
    </label>
    <label class="field">
      <span>Every time</span>
      <select v-model.number="settings.intervalMin">
        <option :value="0">Off</option>
        <option v-for="m in [1, 2, 5, 10, 15]" :key="m" :value="m">{{ m }} min</option>
      </select>
    </label>
    <label class="field">
      <span>Voice speed</span>
      <input v-model.number="settings.voiceRate" type="range" min="0.7" max="1.5" step="0.1" />
    </label>
    <button @click="testVoice">Test voice</button>
    <p class="muted small">Tap the big pace number on the run screen any time to hear your pace.</p>
  </div>

  <div class="card">
    <h2>Target pace</h2>
    <label class="field">
      <span>Alerts</span>
      <input v-model="settings.targetEnabled" type="checkbox" />
    </label>
    <label class="field">
      <span>Target /{{ settings.unit }}</span>
      <input v-model.lazy="targetText" inputmode="numeric" placeholder="5:30" :disabled="!settings.targetEnabled" />
    </label>
    <label class="field">
      <span>Tolerance</span>
      <select v-model.number="settings.tolerance" :disabled="!settings.targetEnabled">
        <option v-for="t in [5, 10, 15, 20, 30]" :key="t" :value="t">± {{ t }} s</option>
      </select>
    </label>
    <p class="muted small">Says "speed up" or "slow down" when your 30-second pace leaves the range. At most every 30 s, starting after the first minute.</p>
  </div>

  <div class="card">
    <label class="field">
      <span>Auto-pause when stopped</span>
      <input v-model="settings.autoPause" type="checkbox" :disabled="running" />
    </label>
  </div>

  <div v-if="!standalone" class="card muted small">
    <b>Install:</b>
    <template v-if="isIos"> tap Share → "Add to Home Screen".</template>
    <template v-else> use your browser menu → "Install app" / "Add to Home screen".</template>
    Keep MyPacer open on screen while running. Phones stop GPS for web apps in the background.
  </div>
</template>

<style scoped>
h2 {
  font-size: 1rem;
  margin: 0 0 8px;
}
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
}
select,
input:not([type]),
input[inputmode] {
  font: inherit;
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  min-width: 120px;
}
input[type='checkbox'] {
  width: 24px;
  height: 24px;
  accent-color: var(--accent);
}
.seg {
  display: flex;
  gap: 6px;
}
.seg button {
  padding: 10px 16px;
  background: var(--bg);
  border: 1px solid var(--border);
}
.seg button.on {
  background: var(--accent);
  color: #04130a;
}
.small {
  font-size: 0.85rem;
}
</style>
