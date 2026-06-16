import { getMonthOptions, type FiscalPeriodMode, type FiscalPeriodSelection, resolveFiscalPeriod } from './fiscalPeriods'

interface FiscalPeriodSelectorProps {
  availableYears: number[]
  selection: FiscalPeriodSelection
  onChange: (selection: FiscalPeriodSelection) => void
  title?: string
  description?: string
}

const monthOptions = getMonthOptions()

export function FiscalPeriodSelector({
  availableYears,
  selection,
  onChange,
  title = 'Periodo fiscal',
  description = 'Selecciona el rango que gobernará resumen, incidencias, soportes y export.',
}: FiscalPeriodSelectorProps) {
  const resolvedPeriod = resolveFiscalPeriod(selection)
  const yearOptions = [...new Set<number>([...availableYears, selection.year, new Date().getFullYear()])]
    .sort((left, right) => right - left)

  function updateSelection(patch: Partial<FiscalPeriodSelection>) {
    onChange({
      ...selection,
      ...patch,
    })
  }

  function handleModeChange(mode: FiscalPeriodMode) {
    updateSelection({ mode })
  }

  return (
    <section className="cc-dashboard-block">
      <div className="cc-dashboard-block__header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      <div className="cc-quarterly-pack-grid">
        <article className="cc-quarterly-persistence__card">
          <span className="cc-dashboard-panel__label">Tipo de periodo</span>
          <div className="cc-inline-toggle-group" role="tablist" aria-label="Selector de periodo fiscal">
            {([
              ['month', 'Mes'],
              ['quarter', 'Trimestre'],
              ['year', 'Año'],
              ['custom', 'Personalizado'],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={selection.mode === mode ? 'secondary-button is-active' : 'secondary-button'}
                onClick={() => handleModeChange(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </article>

        <article className="cc-quarterly-persistence__card">
          <span className="cc-dashboard-panel__label">Configuración</span>
          <div className="cc-inline-form-grid">
            <label className="cc-inline-field">
              <span>Año</span>
              <select
                value={selection.year}
                onChange={(event) => updateSelection({ year: Number(event.target.value) })}
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>

            {selection.mode === 'month' ? (
              <label className="cc-inline-field">
                <span>Mes</span>
                <select
                  value={selection.month}
                  onChange={(event) => updateSelection({ month: Number(event.target.value) })}
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {selection.mode === 'quarter' ? (
              <label className="cc-inline-field">
                <span>Trimestre</span>
                <select
                  value={selection.quarter}
                  onChange={(event) => updateSelection({ quarter: Number(event.target.value) })}
                >
                  {[1, 2, 3, 4].map((quarter) => (
                    <option key={quarter} value={quarter}>{`T${quarter}`}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {selection.mode === 'custom' ? (
              <>
                <label className="cc-inline-field">
                  <span>Desde</span>
                  <input
                    type="date"
                    value={selection.startDate}
                    onChange={(event) => updateSelection({ startDate: event.target.value })}
                  />
                </label>
                <label className="cc-inline-field">
                  <span>Hasta</span>
                  <input
                    type="date"
                    value={selection.endDate}
                    onChange={(event) => updateSelection({ endDate: event.target.value })}
                  />
                </label>
              </>
            ) : null}
          </div>
        </article>

        <article className="cc-quarterly-persistence__card">
          <span className="cc-dashboard-panel__label">Periodo activo</span>
          <strong className="cc-kpi-value">{resolvedPeriod.label}</strong>
          <p className="cc-dashboard-panel__text">
            {resolvedPeriod.startDate} → {resolvedPeriod.endDate}
          </p>
        </article>
      </div>
    </section>
  )
}
