import { useRef } from 'react'
import { gsap, motionDurationBase, motionDurationFast, motionEaseStandard, useGSAP, useReducedMotion } from '../../../design-system/motion'
import type { SvgChartPoint } from './SvgLineChart'

interface SvgBarChartProps {
  data: SvgChartPoint[]
}

const CHART_HEIGHT = 180
const CHART_WIDTH = 320
const PADDING_X = 18
const PADDING_TOP = 18
const PADDING_BOTTOM = 34

export function SvgBarChart({ data }: SvgBarChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const prefersReducedMotion = useReducedMotion()

  const maxValue = Math.max(...data.map((point) => point.value), 1)
  const innerWidth = CHART_WIDTH - (PADDING_X * 2)
  const innerHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const gap = 12
  const barWidth = Math.max((innerWidth - (gap * (data.length - 1))) / Math.max(data.length, 1), 28)

  useGSAP(
    () => {
      if (!svgRef.current || prefersReducedMotion) return

      const bars = svgRef.current.querySelectorAll<SVGRectElement>('[data-chart-bar]')
      const labels = svgRef.current.querySelectorAll<SVGTextElement>('[data-chart-bar-value]')

      gsap.fromTo(
        bars,
        { scaleY: 0, transformOrigin: 'center bottom' },
        {
          delay: 0.04,
          duration: motionDurationBase,
          ease: motionEaseStandard,
          scaleY: 1,
          stagger: 0.05,
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
          stagger: 0.05,
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
      className="cc-home-svg-chart cc-home-svg-chart--bars"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label="Grafico de barras con frentes fiscales abiertos"
    >
      <line className="cc-home-svg-chart__axis" x1={PADDING_X} y1={CHART_HEIGHT - PADDING_BOTTOM} x2={CHART_WIDTH - PADDING_X} y2={CHART_HEIGHT - PADDING_BOTTOM} />
      {data.map((point, index) => {
        const height = point.value > 0 ? Math.max((point.value / maxValue) * innerHeight, 10) : 6
        const x = PADDING_X + (index * (barWidth + gap))
        const y = PADDING_TOP + innerHeight - height

        return (
          <g key={point.label}>
            <rect
              className="cc-home-svg-chart__bar"
              data-chart-bar
              x={x}
              y={y}
              width={barWidth}
              height={height}
              rx="12"
              ry="12"
            />
            <text className="cc-home-svg-chart__value" data-chart-bar-value x={x + (barWidth / 2)} y={y - 8} textAnchor="middle">
              {point.value}
            </text>
            <text className="cc-home-svg-chart__label" x={x + (barWidth / 2)} y={CHART_HEIGHT - 8} textAnchor="middle">
              {point.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
