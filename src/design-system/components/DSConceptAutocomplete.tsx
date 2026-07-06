import { useMemo, useState } from 'react'
import type { ConceptSuggestion } from '../../features/concepts/conceptMemory'
import { useRecentConceptSuggestions } from '../../features/concepts/useRecentConceptSuggestions'
import { DSInlineSuggestionList } from './DSInlineSuggestionList'
import { DSInput } from './DSInput'
import { DSProFormField } from './DSProFormField'
import './design-system.css'

interface DSConceptAutocompleteProps {
  label: string
  value: string
  onChange: (value: string) => void
  suggestions: ConceptSuggestion[]
  onUseConcept: (suggestion: ConceptSuggestion) => void
  onUseStructuredSuggestion?: (suggestion: ConceptSuggestion) => void
  hint?: string
  placeholder?: string
  required?: boolean
  className?: string
}

function normalizeLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function canOfferRecentSave(value: string) {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed.length >= 4 && trimmed.length <= 80
}

export function DSConceptAutocomplete({
  label,
  value,
  onChange,
  suggestions,
  onUseConcept,
  onUseStructuredSuggestion,
  hint,
  placeholder,
  required = false,
  className,
}: DSConceptAutocompleteProps) {
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const { recentSuggestions, saveRecentConcept } = useRecentConceptSuggestions(value)

  const mergedSuggestions = useMemo(() => {
    const seen = new Set<string>()
    return [...recentSuggestions, ...suggestions]
      .filter((suggestion) => {
        const key = normalizeLabel(suggestion.label)
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 5)
  }, [recentSuggestions, suggestions])

  function handleSelectSuggestion(suggestion: ConceptSuggestion) {
    onUseConcept(suggestion)
    setIsOpen(false)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (mergedSuggestions.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
      setHighlightedIndex((current) => Math.min(current + 1, mergedSuggestions.length - 1))
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((current) => Math.max(current - 1, 0))
    }

    if (event.key === 'Enter' && isOpen) {
      const suggestion = mergedSuggestions[highlightedIndex]
      if (!suggestion) return
      event.preventDefault()
      handleSelectSuggestion(suggestion)
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const listItems = mergedSuggestions.map((suggestion, index) => ({
    key: suggestion.key,
    label: suggestion.label,
    meta: suggestion.structuredSuggestion
      ? [suggestion.structuredSuggestion.quantity, suggestion.structuredSuggestion.unit, suggestion.structuredSuggestion.unit_price]
        .filter(Boolean)
        .join(' · ')
      : undefined,
    badges: suggestion.reasons,
    isActive: isOpen && index === highlightedIndex,
    primaryLabel: 'Usar',
    secondaryLabel: suggestion.structuredSuggestion && onUseStructuredSuggestion ? 'Linea' : undefined,
    onHover: () => setHighlightedIndex(index),
    onPrimary: () => handleSelectSuggestion(suggestion),
    onSecondary: suggestion.structuredSuggestion && onUseStructuredSuggestion
      ? () => {
          onUseStructuredSuggestion(suggestion)
          setIsOpen(false)
        }
      : undefined,
  }))

  return (
    <div className={['ds-concept-autocomplete', className ?? ''].filter(Boolean).join(' ')}>
      <DSProFormField label={label} hint={hint} required={required}>
        <DSInput
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            setHighlightedIndex(0)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
      </DSProFormField>

      {isOpen && mergedSuggestions.length > 0 ? (
        <div className="ds-concept-autocomplete__list">
          <DSInlineSuggestionList items={listItems} />
          {canOfferRecentSave(value) ? (
            <div className="ds-concept-autocomplete__footer">
              <button
                type="button"
                className="secondary-button ds-concept-autocomplete__save"
                onClick={() => {
                  if (saveRecentConcept(value)) {
                    setIsOpen(false)
                  }
                }}
              >
                Guardar frecuente
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
