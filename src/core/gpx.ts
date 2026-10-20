import type { RunRecord } from './run'
import type { TrackPoint } from './tracker'

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!)
}

function trkpt(p: TrackPoint): string {
  const ele = p.alt != null ? `<ele>${p.alt.toFixed(1)}</ele>` : ''
  return `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">${ele}<time>${new Date(p.t).toISOString()}</time></trkpt>`
}

export function runName(run: RunRecord): string {
  const d = new Date(run.startedAt)
  return `Run ${d.toISOString().slice(0, 10)}`
}

export function toGpx(run: RunRecord): string {
  const segments = new Map<number, TrackPoint[]>()
  for (const p of run.points) {
    if (!segments.has(p.seg)) segments.set(p.seg, [])
    segments.get(p.seg)!.push(p)
  }
  const segs = [...segments.values()]
    .map((pts) => `    <trkseg>\n${pts.map(trkpt).join('\n')}\n    </trkseg>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MyPacer" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><time>${new Date(run.startedAt).toISOString()}</time></metadata>
  <trk>
    <name>${escapeXml(runName(run))}</name>
    <type>running</type>
${segs}
  </trk>
</gpx>
`
}
