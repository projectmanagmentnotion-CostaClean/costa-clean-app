interface SearchBarProps {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
  resultCount?: number
  totalCount?: number
}

export function SearchBar({
  label,
  value,
  placeholder,
  onChange,
  resultCount,
  totalCount,
}: SearchBarProps) {
  const showCounter =
    typeof resultCount === 'number' && typeof totalCount === 'number'

  return (
    <div className="searchbar-block">
      <div className="searchbar-top">
        <label className="form-field form-field-full searchbar-field">
          <span>{label}</span>

          <div className="searchbar-input-wrap">
            <input
              type="search"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              className="searchbar-input"
            />

            {value ? (
              <button
                type="button"
                className="searchbar-clear"
                onClick={() => onChange('')}
                aria-label="Limpiar búsqueda"
                title="Limpiar búsqueda"
              >
                Limpiar
              </button>
            ) : null}
          </div>
        </label>
      </div>

      {showCounter ? (
        <div className="searchbar-results">
          <span>
            Mostrando {resultCount} de {totalCount} resultados
          </span>
        </div>
      ) : null}
    </div>
  )
}
