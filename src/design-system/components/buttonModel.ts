export type DSButtonTone = 'primary' | 'secondary' | 'tertiary' | 'danger'

export interface DSButtonModelOptions {
  tone: DSButtonTone
  fullWidth: boolean
  loading: boolean
}

export function getDSButtonClassNames({ tone, fullWidth, loading }: DSButtonModelOptions) {
  return [
    'ds-button',
    `ds-button--${tone}`,
    fullWidth ? 'ds-button--full' : '',
    loading ? 'ds-button--loading' : '',
    tone === 'primary' ? 'primary-button' : '',
    tone === 'secondary' ? 'secondary-button' : '',
    tone === 'tertiary' ? 'tertiary-button' : '',
    tone === 'danger' ? 'danger-button' : '',
  ].filter(Boolean).join(' ')
}
