# Costa Clean brand system

## Scope

This document is the source of truth for the official Costa Clean identity used by the authenticated V3 product. It distinguishes brand primitives from semantic UI tokens. V3 semantic colors remain governed by `src/v3/design/tokens.css`; the official blue is not a blanket replacement for operational accent, status, danger, success or neutral colors.

## Official primitives

| Primitive | Value | Use |
|---|---|---|
| Costa Clean blue | `#00AEF0` | Logo, approved brand accents and branded communications |
| Black | `#000000` | Official monochrome logo variant and high-contrast brand use |
| White | `#FFFFFF` | Reversed logo variant and clear space |

## Asset rules

- Use the typed registry in `src/v3/brand/brandAssets.ts`; do not recreate or inline a logo.
- Select the variant by background and available clear space.
- Preserve the original aspect ratio and do not recolor, stretch, crop or add effects.
- Keep brand primitives separate from semantic product UI tokens.
- The official inventory is local under `public/branding/`; no runtime hotlinks are allowed.
- `logo-costa-clean.svg` and `logo-costa-clean-web.svg` are retained as existing vector sources; the canonical registry uses the approved named variants explicitly.

## Accessibility

Brand blue is not assumed to pass every text contrast combination. Check contrast for the actual foreground/background pair and use semantic text tokens where the content is operational.

## Provenance

The inventory consists of repository-provided brand assets already present at the start of V3-10A. Hashes and dimensions are verified by the brand registry test; no external download is part of this slice.
