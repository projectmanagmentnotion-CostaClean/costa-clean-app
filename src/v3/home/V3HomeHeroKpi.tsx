import type { ReactNode } from 'react'
import { V3PrimaryAction } from '../components/V3Primitives'

export function V3HomeHeroKpi({ value, onOpen }: { value: string; onOpen: () => void }): ReactNode {
  return <section className="v3-home-hero" aria-labelledby="v3-home-hero-title"><div><span className="v3-home-eyebrow">Facturación del mes</span><strong id="v3-home-hero-title">{value}</strong><p>Facturas emitidas en el mes actual.</p></div><V3PrimaryAction onClick={onOpen}>Ver facturas</V3PrimaryAction></section>
}
