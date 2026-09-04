/**
 * Controlled copy of the frozen Costa Clean web tokens.
 * Source: costa-clean-web@af872b3, U5 freeze / U6E design tokens.
 * This file intentionally has no runtime dependency on the public web.
 */
export const portalTokens = {
  color: {
    brand: '#00AEF0',
    brandStrong: '#0088BD',
    ocean: '#0B1924',
    slate: '#132230',
    surface: '#F5F9FC',
    line: '#D2E3EE',
    white: '#FFFFFF',
    muted: '#425466',
    success: '#0B8256',
    warning: '#D97706',
    danger: '#D32F2F',
  },
  font: { display: 'Epilogue', body: 'Manrope' },
  size: { touch: '44px', header: '4.5rem', content: '72rem' },
  motion: { fast: '180ms', base: '320ms', ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
} as const
