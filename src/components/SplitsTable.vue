<script setup lang="ts">
import { formatDuration, formatPace } from '../core/pace'
import type { Split } from '../core/splits'
import { METERS_PER, toUnit, type Unit } from '../core/units'

const props = defineProps<{ splits: Split[]; unit: Unit }>()

const pace = (s: Split) => formatPace(s.durationMs / 1000 / toUnit(s.distance, props.unit))
const label = (s: Split) =>
  Math.abs(s.distance - METERS_PER[props.unit]) < 1 ? String(s.index) : toUnit(s.distance, props.unit).toFixed(2)
</script>

<template>
  <table v-if="splits.length">
    <thead>
      <tr>
        <th>{{ unit }}</th>
        <th>Time</th>
        <th>Pace /{{ unit }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="s in splits" :key="s.index">
        <td>{{ label(s) }}</td>
        <td>{{ formatDuration(s.durationMs) }}</td>
        <td>{{ pace(s) }}</td>
      </tr>
    </tbody>
  </table>
</template>
