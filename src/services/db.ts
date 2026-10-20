import { openDB, type DBSchema } from 'idb'
import type { RunRecord } from '../core/run'

interface PacerDB extends DBSchema {
  runs: { key: string; value: RunRecord }
  /** The in-progress run, saved periodically so a crash or reload doesn't lose it */
  current: { key: 'run'; value: RunRecord }
}

const dbPromise = openDB<PacerDB>('mypacer', 1, {
  upgrade(db) {
    db.createObjectStore('runs', { keyPath: 'id' })
    db.createObjectStore('current')
  },
})

export async function listRuns(): Promise<RunRecord[]> {
  const runs = await (await dbPromise).getAll('runs')
  return runs.sort((a, b) => b.startedAt - a.startedAt)
}

export async function getRun(id: string) {
  return (await dbPromise).get('runs', id)
}

export async function saveRun(run: RunRecord) {
  await (await dbPromise).put('runs', run)
}

export async function deleteRun(id: string) {
  await (await dbPromise).delete('runs', id)
}

export async function saveCurrent(run: RunRecord) {
  await (await dbPromise).put('current', run, 'run')
}

export async function getCurrent() {
  return (await dbPromise).get('current', 'run')
}

export async function clearCurrent() {
  await (await dbPromise).delete('current', 'run')
}
