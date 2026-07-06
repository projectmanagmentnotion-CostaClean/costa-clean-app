import { DSFilterChip } from '../../../design-system/components'

export interface HomePeriodOption {
  key: string
  label: string
}

interface HomePeriodSelectorProps {
  options: HomePeriodOption[]
  value: string
  onChange: (nextValue: string) => void
  ariaLabel: string
  compact?: boolean
}

export function HomePeriodSelector({
  options,
  value,
  onChange,
  ariaLabel,
  compact = false,
}: HomePeriodSelectorProps) {
  if (options.length <= 1) return null

  return (
    <div
      className={['cc-home-period-selector', compact ? 'cc-home-period-selector--compact' : ''].filter(Boolean).join(' ')}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <DSFilterChip
          key={option.key}
          active={option.key === value}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </DSFilterChip>
      ))}
    </div>
  )
}
