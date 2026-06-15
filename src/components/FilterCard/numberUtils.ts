const MAX_STEP_PRECISION = 6

export const getStepPrecision = (step: number, fallbackPrecision = 0) => {
  if (!Number.isFinite(step) || step <= 0) return fallbackPrecision

  const absStep = Math.abs(step)
  const tolerance = Math.max(Number.EPSILON * 100, absStep * 1e-6)

  for (let precision = 0; precision <= MAX_STEP_PRECISION; precision += 1) {
    const rounded = Number(absStep.toFixed(precision))
    if (Math.abs(rounded - absStep) <= tolerance) {
      return precision
    }
  }

  return MAX_STEP_PRECISION
}

export const normalizeStep = (step: number, fallbackStep = 1) => {
  if (!Number.isFinite(step) || step <= 0) return fallbackStep
  const precision = getStepPrecision(step)
  const normalized = Number(step.toFixed(precision))
  return normalized > 0 ? normalized : step
}

export const snapToStep = (value: number, step: number, min = 0, max = Infinity) => {
  const safeStep = normalizeStep(step)
  const lower = Number.isFinite(min) ? min : -Infinity
  const upper = Number.isFinite(max) ? max : Infinity
  const stepBase = Number.isFinite(min) ? min : 0
  const clamped = Math.min(Math.max(value, lower), upper)
  const precision = getStepPrecision(safeStep)
  const snapped = Math.round((clamped - stepBase) / safeStep) * safeStep + stepBase
  return Number(Math.min(Math.max(snapped, lower), upper).toFixed(precision))
}
