import { useRef } from 'react'
import { gsap, motionDurationFast, motionDurationSlow, motionEaseStandard, useGSAP, useReducedMotion, drawSvgPath } from '../../../design-system/motion'

export interface SvgChartPoint {
  label: string
  value: number
}

interface SvgLineChartProps {
  data: SvgChartPoint[]
}

const CHART_HEIGHT = 180
const CHART_WIDTH = 320
const PADDING_X = 22
const PADDING_TOP = 18
const PADDING_BOTTOM = 34

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return ''
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

export function SvgLineChart({ data }: SvgLineChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const pathRef = useRef<SVGPathElement | null>(null)
  const prefersReducedMotion = useReducedMotion()

  const maxValue = Math.max(...data.map((point) => point.value), 1)
  const innerWidth = CHART_WIDTH - (PADDING_X * 2)
  const innerHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const step = data.length > 1 ? innerWidth / (data.length - 1) : innerWidth

  const points = data.map((point, index) => ({
    ...point,
    x: PADDING_X + (step * index),
    y: PADDING_TOP + innerHeight - ((point.value / maxValue) * innerHeight),
  }))

  const path = buildLinePath(points)

  useGSAP(
    () => {
      if (!svgRef.current || prefersReducedMotion) return

      const markers = svgRef.current.querySelectorAll<SVGCircleElement>('[data-chart-marker]')
      const labels = svgRef.current.querySelectorAll<SVGGElement>('[data-chart-label]')

      if (pathRef.current) {
        void drawSvgPath(pathRef.current, {
          duration: motionDurationSlow,
        })
      }

      gsap.fromTo(
        markers,
        { autoAlpha: 0, scale: 0.94, transformOrigin: 'center center' },
        {
          autoAlpha: 1,
          delay: 0.08,
          duration: motionDurationFast,
          ease: motionEaseStandard,
          scale: 1,
          stagger: 0.04,
        },
      )

      gsap.fromTo(
        labels,
        { autoAlpha: 0, y: 4 },
        {
          autoAlpha: 1,
          delay: 0.12,
          duration: motionDurationFast,
          ease: motionEaseStandard,
          stagger: 0.04,
          y: 0,
        },
      )
    },
    {
      dependencies: [data.map((point) => point.value).join('|'), prefersReducedMotion],
      scope: svgRef,
    },
  )

  return (
    <svg
      ref={svgRef}
      className="cc-home-svg-chart cc-home-svg-chart--line"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label="Grafico de linea con carga operativa inmediata"
    >
      <line className="cc-home-svg-chart__axis" x1={PADDING_X} y1={CHART_HEIGHT - PADDING_BOTTOM} x2={CHART_WIDTH - PADDING_X} y2={CHART_HEIGHT - PADDING_BOTTOM} />
      <path ref={pathRef} className="cc-home-svg-chart__line" d={path} fill="none" />
      {points.map((point) => (
        <g key={point.label} data-chart-label>
          <circle className="cc-home-svg-chart__marker" data-chart-marker cx={point.x} cy={point.y} r="4" />
          <text className="cc-home-svg-chart__value" x={point.x} y={point.y - 10} textAnchor="middle">
            {point.value}
          </text>
          <text className="cc-home-svg-chart__label" x={point.x} y={CHART_HEIGHT - 8} textAnchor="middle">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
