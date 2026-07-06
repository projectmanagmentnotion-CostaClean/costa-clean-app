import { useRef } from 'react'
import { drawSvgPath, motionDurationSlow, useGSAP, useReducedMotion } from '../../../design-system/motion'

interface SvgRadialProgressProps {
  label: string
  percent: number
}

const SIZE = 180
const CENTER = SIZE / 2
const RADIUS = 58

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180

  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians)),
  }
}

function describeArc(centerX: number, centerY: number, radius: number, percent: number) {
  if (percent <= 0) return ''
  const endAngle = (Math.min(percent, 100) / 100) * 359.99
  const start = polarToCartesian(centerX, centerY, radius, endAngle)
  const end = polarToCartesian(centerX, centerY, radius, 0)
  const largeArcFlag = endAngle > 180 ? '1' : '0'

  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
  ].join(' ')
}

export function SvgRadialProgress({ label, percent }: SvgRadialProgressProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const progressRef = useRef<SVGPathElement | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const progressPath = describeArc(CENTER, CENTER, RADIUS, percent)

  useGSAP(
    () => {
      if (!progressRef.current || prefersReducedMotion || !progressPath) return
      void drawSvgPath(progressRef.current, { duration: motionDurationSlow })
    },
    {
      dependencies: [percent, progressPath, prefersReducedMotion],
      scope: svgRef,
    },
  )

  return (
    <svg
      ref={svgRef}
      className="cc-home-svg-chart cc-home-svg-chart--radial"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`${label}: ${percent}%`}
    >
      <circle className="cc-home-svg-chart__track" cx={CENTER} cy={CENTER} r={RADIUS} />
      {progressPath ? <path ref={progressRef} className="cc-home-svg-chart__arc" d={progressPath} fill="none" /> : null}
      <text className="cc-home-svg-chart__radial-value" x={CENTER} y={CENTER - 4} textAnchor="middle">
        {percent}%
      </text>
      <text className="cc-home-svg-chart__radial-label" x={CENTER} y={CENTER + 20} textAnchor="middle">
        {label}
      </text>
    </svg>
  )
}
