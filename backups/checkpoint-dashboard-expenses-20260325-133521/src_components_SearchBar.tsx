import './SearchBar.css'

interface SearchBarProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  resultCount?: number
  totalCount?: number
}

export function SearchBar({
  label,
  value,
  onChange,
  placeholder,
  resultCount,
  totalCount,
}: SearchBarProps) {
  const showCount =
    typeof resultCount === 'number' && typeof totalCount === 'number'

  return (
    <div className="cc-searchbar">
      <label className="cc-searchbar__label">{label}</label>

      <div className="cc-searchbar__control">
        <input
          className="cc-searchbar__input"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder ?? 'Buscar'}
        />
      </div>

      {showCount ? (
        <p className="cc-searchbar__count">
          Mostrando {resultCount} de {totalCount} resultados
        </p>
      ) : null}
    </div>
  )
}
