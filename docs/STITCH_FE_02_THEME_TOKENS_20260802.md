# STITCH-FE-02 - Theme tokens, foundations and visual invariance

## Objective

Normalize the existing Maritime Professional theme foundation without changing module behavior, routes, navigation, logic, data, or protected contracts.

## Scope executed

- CSS tokens for color, surface, border, focus, shadow, radius and motion.
- Theme metadata colors for browser chrome.
- A focused theme test covering persistence and DOM metadata.
- Documentation only, no product shell or module restructuring.

## Files touched

- `src/index.css`
- `src/App.css`
- `src/app/theme.ts`
- `src/app/theme.test.ts`

## Validation performed

- `pnpm exec eslint src/app/theme.ts src/app/theme.test.ts`
- `pnpm exec vitest run src/app/theme.test.ts --config vitest.config.mjs`
- `pnpm run lint` - failed on pre-existing repo debt outside this sprint
- `pnpm run test` - failed on pre-existing client portal manifest debt outside this sprint
- `pnpm run build` - passed

## Functional invariance statement

VEREDICTO DE INVARIANCIA FUNCIONAL:
No se modificaron logica, datos, contratos, navegacion, autenticacion,
Supabase, calculos financieros/fiscales ni consecuencias operativas.

## Notes

- The visual change is limited to token-level presentation reconciliation.
- No JSX, router, Supabase, financial or fiscal logic was altered.
