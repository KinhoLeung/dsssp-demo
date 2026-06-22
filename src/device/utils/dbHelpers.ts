import type { webhmi } from '@/device/proto/generated/webhmi'

export type PendingEqTarget = {
  target: webhmi.EqTarget
  sceneMode?: webhmi.OutputSceneMode
  bypass?: boolean
  points: Map<number, webhmi.IEqPointPatch>
}

export const base64ToBytes = (b64: string): Uint8Array => {
  let normalized = b64.replace(/[\r\n\s]/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4
  if (pad) normalized += '='.repeat(4 - pad)
  const bin = atob(normalized)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export const cloneObject = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

export const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Object.prototype.toString.call(v) === '[object Object]'

export const mergeDefinedObjects = (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    const prev = out[k]
    if (isPlainObject(prev) && isPlainObject(v)) {
      out[k] = mergeDefinedObjects(prev, v)
    } else {
      out[k] = v
    }
  }
  return out
}

export const mergePatch = <T extends object>(base: T | undefined, patch: T): T => {
  const a = (base ?? {}) as unknown as Record<string, unknown>
  const b = patch as unknown as Record<string, unknown>
  return mergeDefinedObjects(a, b) as unknown as T
}

export const applySectionPatch = <T extends object>(section: T | null | undefined, patch: object): T | null | undefined => {
  if (!section) return section
  return mergeDefinedObjects(section as unknown as Record<string, unknown>, patch as Record<string, unknown>) as unknown as T
}

export const getOutputSceneMode = (db: webhmi.IDeviceConfig | null): webhmi.OutputSceneMode => {
  const value = db?.db?.system?.sceneMode
  return typeof value === 'number' ? value as webhmi.OutputSceneMode : 0
}

export const getEqPendingKey = (target: webhmi.EqTarget, sceneMode?: webhmi.OutputSceneMode) =>
  sceneMode === undefined ? String(target) : `${target}:${sceneMode}`

export const getEqRefByTarget = (
  db: webhmi.IDeviceConfig,
  target: webhmi.EqTarget,
  sceneMode = getOutputSceneMode(db),
): webhmi.IEq | null => {
  const d = db.db
  if (!d) return null
  const isDance = sceneMode === 1
  switch (target) {
    case 0:
      return d.music?.eq ?? null
    case 1:
      return d.mic?.micAEq?.eq ?? null
    case 2:
      return d.mic?.micBEq?.eq ?? null
    case 3:
      return d.reverb?.eq ?? null
    case 4:
      return d.echo?.eq ?? null
    case 5:
      return isDance ? d.mainOutput?.danceEq ?? d.mainOutput?.singEq ?? null : d.mainOutput?.singEq ?? d.mainOutput?.danceEq ?? null
    case 6:
      return isDance ? d.subOutput?.danceEq ?? d.subOutput?.singEq ?? null : d.subOutput?.singEq ?? d.subOutput?.danceEq ?? null
    case 7:
      return isDance ? d.center?.danceEq ?? d.center?.singEq ?? null : d.center?.singEq ?? d.center?.danceEq ?? null
    case 8:
      return isDance ? d.surround?.danceEq ?? d.surround?.singEq ?? null : d.surround?.singEq ?? d.surround?.danceEq ?? null
    default:
      return null
  }
}

export const applyEqBypassPatch = (
  db: webhmi.IDeviceConfig,
  target: webhmi.EqTarget,
  bypass: boolean,
  sceneMode?: webhmi.OutputSceneMode,
): webhmi.IDeviceConfig => {
  const eq = getEqRefByTarget(db, target, sceneMode)
  if (!eq) return db
  eq.bypass = bypass
  return db
}

export const getEqPointRefByTargetAndIndex = (
  db: webhmi.IDeviceConfig,
  target: webhmi.EqTarget,
  index: number,
  sceneMode?: webhmi.OutputSceneMode,
): webhmi.IEqPoint | null => {
  const eq = getEqRefByTarget(db, target, sceneMode)
  const points = eq?.point
  if (!Array.isArray(points)) return null
  return points.find((p) => p?.index === index) ?? null
}

export const applyEqPointPatch = (
  db: webhmi.IDeviceConfig,
  target: webhmi.EqTarget,
  patch: webhmi.IEqPointPatch,
  sceneMode?: webhmi.OutputSceneMode,
): webhmi.IDeviceConfig => {
  const eq = getEqRefByTarget(db, target, sceneMode)
  if (!eq) return db
  if (!Array.isArray(eq.point)) eq.point = []
  if (typeof patch.index !== 'number') return db

  const idx = eq.point.findIndex((p) => p?.index === patch.index)
  if (idx >= 0) {
    eq.point[idx] = mergePatch(eq.point[idx] ?? {}, patch)
  } else {
    eq.point.push({ ...patch })
  }
  return db
}

export const applyEqPointDefaults = (
  db: webhmi.IDeviceConfig,
  target: webhmi.EqTarget,
  indices?: number[],
  sceneMode?: webhmi.OutputSceneMode,
): webhmi.IDeviceConfig => {
  const eq = getEqRefByTarget(db, target, sceneMode)
  if (!eq?.point?.length) return db

  const allow = indices?.length ? new Set(indices) : null
  for (const p of eq.point) {
    if (!p) continue
    const index = p.index
    if (allow && (typeof index !== 'number' || !allow.has(index))) continue

    if (typeof p.defaultType === 'number') p.type = p.defaultType
    if (typeof p.defaultFreq === 'number') p.freq = p.defaultFreq
    if (typeof p.defaultGain === 'number') p.gain = p.defaultGain
    if (typeof p.defaultQ === 'number') p.q = p.defaultQ
    if (typeof p.defaultPeakQ === 'number') p.peakQ = p.defaultPeakQ
  }

  return db
}

export const hasValue = (v: unknown): v is NonNullable<unknown> => v !== undefined && v !== null

export const nearlyEqual = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps

export const buildEqPatchesFromPending = (
  pendingEq: Map<string, PendingEqTarget>,
  baseDb: webhmi.IDeviceConfig | null,
): webhmi.IEqPatch[] => {
  const out: webhmi.IEqPatch[] = []

  for (const entry of pendingEq.values()) {
    const { target, sceneMode } = entry
    const baseEq = baseDb ? getEqRefByTarget(baseDb, target, sceneMode) : null

    const patch: webhmi.IEqPatch = { target }
    if (sceneMode !== undefined) patch.sceneMode = sceneMode

    if (typeof entry.bypass === 'boolean') {
      const baseBypass = !!baseEq?.bypass
      if (entry.bypass !== baseBypass) patch.bypass = entry.bypass
    }

    const points: webhmi.IEqPointPatch[] = []
    for (const pointPatch of entry.points.values()) {
      if (typeof pointPatch.index !== 'number') continue
      const basePoint = baseEq?.point?.find((p) => p?.index === pointPatch.index) ?? null

      const minimized: webhmi.IEqPointPatch = { index: pointPatch.index }

      if (hasValue(pointPatch.type) && (basePoint == null || pointPatch.type !== basePoint.type)) {
        minimized.type = pointPatch.type
      }
      if (hasValue(pointPatch.freq) && (basePoint == null || pointPatch.freq !== basePoint.freq)) {
        minimized.freq = pointPatch.freq
      }
      if (
        hasValue(pointPatch.gain) &&
        (basePoint == null || !hasValue(basePoint.gain) || !nearlyEqual(pointPatch.gain, basePoint.gain))
      ) {
        minimized.gain = pointPatch.gain
      }
      if (hasValue(pointPatch.q) && (basePoint == null || !hasValue(basePoint.q) || !nearlyEqual(pointPatch.q, basePoint.q))) {
        minimized.q = pointPatch.q
      }
      if (
        hasValue(pointPatch.peakQ) &&
        (basePoint == null || !hasValue(basePoint.peakQ) || !nearlyEqual(pointPatch.peakQ, basePoint.peakQ))
      ) {
        minimized.peakQ = pointPatch.peakQ
      }

      if (Object.keys(minimized).length > 1) points.push(minimized)
    }

    if (points.length > 0) patch.point = points
    if (patch.bypass !== undefined || (patch.point?.length ?? 0) > 0) out.push(patch)
  }

  return out
}
