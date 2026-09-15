# Costa Clean brand system

## Scope

This document is the source of truth for the official Costa Clean identity used by the authenticated V3 product. It distinguishes brand primitives from semantic UI tokens. V3 semantic colors remain governed by `src/v3/design/tokens.css`; the official blue is not a blanket replacement for operational accent, status, danger, success or neutral colors.

Authoritative source: `C:\Users\USUARIO\Desktop\costaclean logo y favicon` (historical prompt path). The exact descriptive folder was not present in this environment; the local source resolved to `C:\Users\USUARIO\Desktop\costaclean`, containing `costa clean  logo.png` and `costa clean  favicon.png`. This absolute path is documentation only and is never a runtime dependency. Desktop originals were not modified.

## Official primitives

| Primitive | Value | Use |
|---|---|---|
| Costa Clean blue | `#00AEF0` | Logo, approved brand accents and branded communications; extracted from the dominant source artwork |
| Black | `#000000` | Official monochrome logo variant and high-contrast brand use |
| White | `#FFFFFF` | Reversed logo variant and clear space |

## Asset rules

- Use the semantic roles in the typed registry in `src/v3/brand/brandAssets.ts`; do not recreate or inline a logo.
- The source supports `logoPrimary`, `brandSymbol`, `favicon`, `appIcon180`, `appIcon192` and `appIcon512`. It does not support separate light, dark or horizontal originals, so those roles are intentionally not exposed.
- Select the variant by background and available clear space.
- Preserve the original aspect ratio and do not recolor, stretch, crop or add effects.
- Keep brand primitives separate from semantic product UI tokens.
- The official inventory is local under `public/branding/`; no runtime hotlinks are allowed.
- `logo-costa-clean.svg` and `logo-costa-clean-web.svg` are retained as existing vector sources; the canonical registry uses the approved named variants explicitly.

## Canonical mapping and hashes

| Role | Original source | Repository asset | Source/repo SHA-256 |
|---|---|---|---|
| `logoPrimary` | `costa clean  logo.png` | `public/branding/logo-primary.png` | `ab8bfd8f69321e756e639795333e1350922b962c677f38e80d6309a3d25854e6` |
| `brandSymbol` | `costa clean  favicon.png` | `public/branding/brand-symbol.png` | `7170ff85ac6e059f917b4c1c915321228fbb20ed174a5e933a07b82c9b37088b` |
| `favicon` | `costa clean  favicon.png` | `public/branding/favicon.png` | Derived 64x64 export; registry records the exact hash |
| `appIcon180` | `costa clean  favicon.png` | `public/branding/app-icon-180.png` | Derived 180x180 export; registry records the exact hash |
| `appIcon192` | `costa clean  favicon.png` | `public/branding/app-icon-192.png` | Derived 192x192 export; registry records the exact hash |
| `appIcon512` | `costa clean  favicon.png` | `public/branding/app-icon-512.png` | Derived 512x512 export; registry records the exact hash |

The source raster files are RGBA. The logo is 2558x2317 and the symbol is 2522x2560. Derived icons preserve the symbol artwork with square dimensions; no vector tracing was performed.

## Accessible UI derivatives

`#006B8F` is the documented UI derivative for blue text on white (6.0:1 contrast). It is not a logo color and must not be written back into official artwork. The official `#00AEF0` remains unchanged in the source files.

## Usage and deprecated files

- Auth, shell, portal, public intake and document/export surfaces now use semantic registry roles.
- PWA, browser favicon and notification icons use the canonical derived icon files.
- `public/favicon.svg` was the generic purple Vite favicon and was removed because it had no runtime references.
- Previous `Costa_Clean-*`, `costaclean-icon-*` and `logo-costa-clean-*` files remain unreferenced for auditability; they are classified as `UNVERIFIED` or `REPLACE_REQUIRED` until a human approves removal. They are not canonical and must not be introduced into new runtime code.

## Accessibility

Brand blue is not assumed to pass every text contrast combination. Check contrast for the actual foreground/background pair and use semantic text tokens where the content is operational.

## Provenance

The canonical inventory is copied from the local authoritative source and derived locally. Hashes, dimensions, manifest paths and runtime existence are verified by the brand registry test; no external download is part of this slice.
