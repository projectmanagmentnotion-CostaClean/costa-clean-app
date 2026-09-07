# Costa Clean App V3 — Design System

Status: `CANDIDATE — HUMAN APPROVAL REQUIRED`. Three Stitch directions are generated and compared in `V3_STITCH_DESIGN_REVIEW.md`. Direction B is the recommended baseline; these tokens must not be implemented in production until the V3-0 approval gate is explicitly closed.

## Design principles

- Mobile-first, operational and calm.
- One decision per screen and one consequence per primary action.
- Flat, breathable surfaces instead of nested card stacks.
- Costa Clean brand appears as accent, active state and CTA detail, not as a full-surface wash.
- Accessibility, readability and one-hand reach outrank decoration.

## Candidate tokens from Stitch evidence

| Area | V3 intent | Approval state |
| --- | --- | --- |
| Typography | Plus Jakarta Sans for headline/labels; Inter is acceptable for dense operational body copy | CANDIDATE: Stitch A/B/C |
| Spacing | compact 8px-derived rhythm; preserve dense rows and 48px interactive targets | CANDIDATE: Stitch B/C |
| Radius | restrained shared radius; avoid rounded containers around every child | CANDIDATE: Stitch A/B/C |
| Surfaces | graphite/navy operational shell with warm-neutral content option for human review | CANDIDATE: Stitch B + C |
| Borders | 1px structural separators for dense lists; no child-by-child outlines | APPROVED PRINCIPLE: Stitch B |
| Elevation | shallow functional elevation only for filter sheets, sticky bars and dialogs | APPROVED PRINCIPLE: Stitch A/B/C |
| Iconography | coherent Material-style outline family with visible text labels for primary actions | CANDIDATE: Stitch A/B/C |
| Status | text-first semantic states; teal/green success, amber review/pending, red incident/error | APPROVED PRINCIPLE: Stitch B/C |
| Motion | restrained functional motion with mandatory `prefers-reduced-motion` fallback | CONSTITUTIONAL REQUIREMENT |

### Concrete Stitch references

- Direction A exposed `#0D9488` primary, `#0F172A` secondary, `#14B8A6` tertiary, `#64748B` neutral and Plus Jakarta Sans.
- Direction B exposed `#0D9488` primary, `#14B8A6` secondary, `#38BDF8` tertiary, `#0B0F17` neutral, Plus Jakarta Sans headlines and Inter body/labels.
- Direction C exposed `#0D9488` primary, `#1B2A38` secondary, `#D97706` tertiary, `#F5F2EC` neutral and Plus Jakarta Sans.

The final implementation token set must be resolved during human review; do not average or silently merge these palettes.

## Component contract to prototype

The Stitch prototype must demonstrate these components in context, not as an isolated gallery:

- `AppHeader` — back/title/status context, no overflow at 390px.
- `BottomNavigation` — five destinations, active state and safe area.
- `SectionTabs` — only where a real relationship decision exists.
- `EntityListItem` — identity, status, key fact and one compact action cluster.
- `EntityStatus` — semantic text plus accessible visual treatment.
- `QuickAction`, `PrimaryAction`, `SecondaryAction` — explicit hierarchy.
- `BottomSheet`, `FilterSheet`, `SelectionBar` — focus, dismiss, apply and sticky-safe behavior.
- `EntityWorkspace`, `SummaryHero`, `DetailSection` — flat full-screen entity context.
- `FormField`, `StickyCTA` — keyboard-safe and 44px minimum, preferably 48px targets.
- `Toast`, `EmptyState`, `ErrorState`, `LoadingState` — same shell language and clear recovery.

## Action hierarchy

Each workspace has one primary action, a maximum of 2–3 quick actions and a `Más` group for rare/destructive/administrative actions. No essential action relies on hover.

## Accessibility contract

- Minimum interactive target: 44px CSS, preferred 48px.
- Visible focus, readable contrast, semantic labels and keyboard-safe forms.
- Bottom bars honor safe-area insets and never cover a required field or CTA.
- Status is never communicated by color alone.
- Reduced motion is mandatory.

## Approval gate

Do not implement these tokens in the productive shell until Direction A, B and C have been generated, compared and one direction is approved. V3-0 is now ready for that human decision; no V3-1 implementation is authorized by this work block.
