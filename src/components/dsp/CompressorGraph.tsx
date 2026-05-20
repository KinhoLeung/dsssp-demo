import { DRCCurve, DRCGraph } from 'dsssp'
import { useEffect, useMemo, useRef, useState } from 'react'

import parameterRanges, { type RangeConfig } from '../../configs/parameterRanges'
import scale from '../../configs/scale'
import theme from '../../configs/theme'

const defaultThresholdRange = parameterRanges.mic.compressor.threshold

export type CompressorGraphProps = {
  threshold?: number | null
  ratio?: number | null
  attack?: number | null
  release?: number | null
  disabled?: boolean
  thresholdRange?: RangeConfig
}

export function CompressorGraph({
  threshold,
  ratio,
  attack,
  release,
  disabled,
  thresholdRange = defaultThresholdRange,
}: CompressorGraphProps) {
  const graphContainerRef = useRef<HTMLDivElement | null>(null)
  const [graphWidth, setGraphWidth] = useState(0)
  const { min: thresholdMin, max: thresholdMax } = thresholdRange

  const drcScale = useMemo(
    () => ({
      ...scale,
      minGain: thresholdMin,
      maxGain: thresholdMax,
      displayMinGain: thresholdMin,
      displayMaxGain: thresholdMax,
      dbSteps: 10,
      dbLabelSteps: 10,
    }),
    [thresholdMin, thresholdMax],
  )

  useEffect(() => {
    const element = graphContainerRef.current
    if (!element) return

    const updateWidth = () => {
      const nextWidth = Math.floor(element.getBoundingClientRect().width)
      setGraphWidth((prevWidth) => (prevWidth === nextWidth ? prevWidth : nextWidth))
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const resolvedThreshold = typeof threshold === 'number' ? threshold : 0
  const resolvedRatio = typeof ratio === 'number' ? ratio : 1
  const graphHeight = 160
  const wrapperClassName = `overflow-hidden rounded-md border border-muted/40 bg-muted/20${
    disabled ? ' opacity-50' : ''
  }`

  return (
    <div ref={graphContainerRef} className={wrapperClassName}>
      {graphWidth > 0 && (
        <DRCGraph width={graphWidth} height={graphHeight} theme={theme} scale={drcScale}>
          <DRCCurve
            threshold={resolvedThreshold}
            ratio={resolvedRatio}
            attack={typeof attack === 'number' ? attack : undefined}
            release={typeof release === 'number' ? release : undefined}
            inputMin={thresholdMin}
            inputMax={thresholdMax}
          />
        </DRCGraph>
      )}
    </div>
  )
}
