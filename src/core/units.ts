export type Unit = 'km' | 'mi'

export const METERS_PER: Record<Unit, number> = { km: 1000, mi: 1609.344 }

export function unitWord(unit: Unit, n = 1): string {
  const word = unit === 'km' ? 'kilometer' : 'mile'
  return n === 1 ? word : `${word}s`
}

export function toUnit(meters: number, unit: Unit): number {
  return meters / METERS_PER[unit]
}

/** Converts a pace in seconds per km to seconds per `unit`. */
export function paceInUnit(secPerKm: number, unit: Unit): number {
  return secPerKm * (METERS_PER[unit] / 1000)
}

/** Converts a pace (seconds per unit) when switching from one unit to another. */
export function convertPace(secPerUnit: number, from: Unit, to: Unit): number {
  return secPerUnit * (METERS_PER[to] / METERS_PER[from])
}
