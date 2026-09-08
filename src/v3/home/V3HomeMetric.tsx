import { V3SecondaryAction } from '../components/V3Primitives'

export function V3HomeMetric({ label, value, onOpen }: { label: string; value: string; onOpen: () => void }) {
  return <V3SecondaryAction ariaLabel={label} onClick={onOpen}><span className="v3-home-metric"><small>{label}</small><strong>{value}</strong></span></V3SecondaryAction>
}
