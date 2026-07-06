import { useMemo, useState } from 'react'
import { findPostalCodeSuggestions, formatPostalCodeSuggestionLabel } from '../../features/locations/postalCodeSuggestions'
import { DSInlineSuggestionList } from './DSInlineSuggestionList'
import { DSInput } from './DSInput'
import { DSProFormField } from './DSProFormField'
import './design-system.css'

interface DSSmartPostalCodeInputProps {
  postalCodeValue: string
  cityValue: string
  provinceValue?: string
  postalCodeError?: string | null
  cityError?: string | null
  provinceError?: string | null
  onPostalCodeChange: (value: string) => void
  onCityChange: (value: string) => void
  onProvinceChange?: (value: string) => void
  postalCodeLabel?: string
  cityLabel?: string
  provinceLabel?: string
  postalCodeHint?: string
  cityHint?: string
  showProvinceField?: boolean
}

export function DSSmartPostalCodeInput({
  postalCodeValue,
  cityValue,
  provinceValue = '',
  postalCodeError,
  cityError,
  provinceError,
  onPostalCodeChange,
  onCityChange,
  onProvinceChange,
  postalCodeLabel = 'Codigo postal',
  cityLabel = 'Ciudad',
  provinceLabel = 'Provincia',
  postalCodeHint = 'Sugerencia local sin backend externo.',
  cityHint,
  showProvinceField = false,
}: DSSmartPostalCodeInputProps) {
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const suggestionQuery = postalCodeValue.trim() || cityValue.trim()
  const suggestions = useMemo(() => findPostalCodeSuggestions(suggestionQuery), [suggestionQuery])

  const listItems = suggestions.map((suggestion, index) => ({
    key: `${suggestion.postalCode}-${suggestion.city}`,
    label: formatPostalCodeSuggestionLabel(suggestion),
    meta: suggestion.province,
    isActive: index === highlightedIndex,
    primaryLabel: 'Aplicar',
    onHover: () => setHighlightedIndex(index),
    onPrimary: () => {
      onPostalCodeChange(suggestion.postalCode)
      onCityChange(suggestion.city)
      onProvinceChange?.(suggestion.province)
    },
  }))

  return (
    <div className="ds-smart-postal">
      <div className="ds-smart-postal__grid">
        <DSProFormField label={postalCodeLabel} hint={postalCodeHint} error={postalCodeError} required>
          <DSInput
            value={postalCodeValue}
            onChange={(event) => onPostalCodeChange(event.target.value)}
            autoComplete="postal-code"
            inputMode="numeric"
            placeholder="08370"
          />
        </DSProFormField>

        <DSProFormField label={cityLabel} hint={cityHint} error={cityError} required>
          <DSInput
            value={cityValue}
            onChange={(event) => onCityChange(event.target.value)}
            autoComplete="address-level2"
            placeholder="Calella"
          />
        </DSProFormField>

        {showProvinceField && onProvinceChange ? (
          <DSProFormField label={provinceLabel} error={provinceError}>
            <DSInput
              value={provinceValue}
              onChange={(event) => onProvinceChange(event.target.value)}
              autoComplete="address-level1"
              placeholder="Barcelona"
            />
          </DSProFormField>
        ) : null}
      </div>

      {suggestions.length > 0 ? (
        <div className="ds-smart-postal__suggestions">
          <DSInlineSuggestionList items={listItems} />
        </div>
      ) : null}
    </div>
  )
}
