import type { ConceptSuggestion } from './conceptMemory'
import './concept-suggestions.css'

interface ConceptSuggestionsProps {
  suggestions: ConceptSuggestion[]
  onUseConcept: (suggestion: ConceptSuggestion) => void
  onUseStructuredSuggestion?: (suggestion: ConceptSuggestion) => void
}

export function ConceptSuggestions({
  suggestions,
  onUseConcept,
  onUseStructuredSuggestion,
}: ConceptSuggestionsProps) {
  if (suggestions.length === 0) return null

  return (
    <div className="cc-concept-suggestions" aria-live="polite">
      <div className="cc-concept-suggestions__header">
        <strong>Sugerencias utiles</strong>
        <small>Priorizadas por cliente, dominio, frecuencia y recencia.</small>
      </div>

      <div className="cc-concept-suggestions__list">
        {suggestions.map((suggestion) => (
          <article key={suggestion.key} className="cc-concept-suggestions__card">
            <div className="cc-concept-suggestions__copy">
              <strong>{suggestion.label}</strong>
              {suggestion.reasons.length > 0 ? (
                <div className="cc-concept-suggestions__meta">
                  {suggestion.reasons.map((reason) => (
                    <span key={`${suggestion.key}-${reason}`} className="cc-concept-suggestions__tag">
                      {reason}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="cc-concept-suggestions__actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => onUseConcept(suggestion)}
              >
                Usar concepto
              </button>
              {onUseStructuredSuggestion && suggestion.structuredSuggestion ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onUseStructuredSuggestion(suggestion)}
                >
                  Usar linea
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
