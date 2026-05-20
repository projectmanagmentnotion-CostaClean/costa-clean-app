import { useId } from 'react'
import './SearchBar.css'

interface SearchBarProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar({
  label,
  value,
  onChange,
  placeholder,
}: SearchBarProps) {
  const inputId = useId()

  return (
    <div className="cc-searchbar">
      <label className="cc-searchbar__label" htmlFor={inputId}>{label}</label>

      <div className="cc-searchbar__control">
        <span className="cc-searchbar__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="17" height="17">
            <path
              d="m19 19-4.2-4.2M16.5 10.8a5.7 5.7 0 1 1-11.4 0 5.7 5.7 0 0 1 11.4 0Z"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.9"
            />
          </svg>
        </span>
        <input
          id={inputId}
          className="cc-searchbar__input"
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder ?? 'Buscar'}
        />
      </div>
    </div>
  )
}
