# Costa Clean — Design System Constitution

**Status:** ACTIVE / BINDING  
**Visual authority:** Google Stitch approved references  
**Functional authority:** existing product contracts and business logic  
**Backend/security authority:** Supabase contracts, RLS, authorization boundaries  
**Primary implementation viewport:** mobile first  
**Applies to:** public website, client portal, shared UI, future marketing/landing surfaces

This document is the non-negotiable design governance contract for Costa Clean. It defines how visual decisions are extracted from Stitch, converted into tokens and components, implemented, reviewed and changed. It does **not** invent the visual design. Numeric visual values that depend on Stitch stay pending until an approved reference exists.

---

## 1. Authority hierarchy

When two sources disagree, use this order:

1. Approved Stitch screen/reference for visual appearance and responsive composition.
2. This constitution for design-system governance and allowed implementation patterns.
3. `docs/stitch/DESIGN.md` for extracted, approved visual values.
4. Existing application/business contracts for behavior.
5. Supabase/security contracts for data and authorization.
6. Existing UI only as reusable implementation evidence, never as visual authority when Stitch differs.

Stitch can define appearance. Stitch cannot weaken accessibility, security, data isolation or business invariants.

If a Stitch reference conflicts with one of those invariants, record the conflict and implement the least visually divergent compliant solution. Never silently redesign it.

---

## 2. Mobile is the primary product contract

Costa Clean is designed and implemented **mobile first**, not desktop first with responsive cleanup later.

### Mandatory order for every new screen

1. Inspect the approved mobile Stitch reference.
2. Extract mobile geometry and hierarchy.
3. Implement mobile.
4. Validate the real screen at `390x844`.
5. Validate fail-safe behavior at `320px` width when the surface can reasonably be used there.
6. Implement/interpolate tablet.
7. Validate `768x1024`.
8. Implement desktop from its Stitch reference.
9. Validate `1440x900`.

A screen cannot receive final visual `PASS` when desktop passes but mobile is partial, approximate or untested.

### Mobile invariants

- No horizontal page overflow.
- No essential hover-only interaction.
- Critical actions must be reachable with one hand whenever the information architecture permits it.
- Interactive targets must be at least `44x44 CSS px` unless a documented exception is necessary for a native semantic control.
- The first useful/actionable content must appear without decorative obstruction.
- Mobile navigation must be intentionally designed; desktop navigation may not simply wrap.
- Tables must transform into an approved compact pattern rather than force horizontal scrolling by default.
- Forms expose the next actionable field immediately.
- Primary CTA must remain visually unambiguous.
- Sticky/fixed elements cannot cover fields, browser chrome safe areas or legal controls.
- Touch spacing must prevent accidental activation of adjacent destructive or conflicting actions.
- Text and controls cannot require pinch zoom to become usable.
- Motion must remain light enough for mid-range mobile hardware.

### Responsive truth

When both desktop and mobile Stitch references exist, **both are authoritative**. Tablet is interpolated between them unless Stitch provides a dedicated tablet reference.

Do not preserve desktop structure when Stitch mobile intentionally reorders, hides, collapses or replaces an element.

---

## 3. Zero arbitrary visual values

Production components must not invent visual values ad hoc.

### Rule

All reusable visual values must resolve through approved design tokens.

Forbidden in normal component styling after tokens are established:

- arbitrary hex/RGB/HSL values;
- arbitrary font sizes;
- arbitrary line heights;
- arbitrary gaps/margins/paddings;
- arbitrary radii;
- arbitrary shadows;
- arbitrary border opacity;
- arbitrary transition durations/easing;
- arbitrary icon sizes;
- arbitrary container widths;
- arbitrary z-index values;
- one-off button heights;
- one-off form control heights.

Allowed exceptions:

- measured media crop/object-position unique to a Stitch composition;
- a browser/platform compatibility fix;
- a one-off geometry value explicitly extracted from a specific Stitch screen and documented as screen-local;
- third-party widget constraints that cannot be tokenized.

Every exception must be visible in code review and documented if it affects visual fidelity.

---

## 4. Required token families

`docs/stitch/DESIGN.md` must eventually define every applicable family below from approved Stitch evidence.

### Color

- `color.brand.*`
- `color.surface.*`
- `color.text.*`
- `color.border.*`
- `color.action.*`
- `color.status.success.*`
- `color.status.warning.*`
- `color.status.error.*`
- `color.status.info.*`
- `color.overlay.*`
- `color.focus.*`

### Typography

- font families;
- display styles;
- heading levels;
- body levels;
- labels;
- captions;
- numeric/data styles;
- button labels;
- line heights;
- letter spacing;
- font weights.

### Spacing

A finite spacing scale must cover:

- inline micro spacing;
- control internal spacing;
- component gaps;
- card padding;
- group spacing;
- section spacing;
- page top/bottom rhythm;
- mobile gutters;
- tablet gutters;
- desktop gutters.

No component creates a private spacing scale.

### Geometry

- border radii;
- border widths;
- control heights;
- button heights;
- icon sizes;
- avatar sizes;
- media ratios;
- max content widths;
- text measure widths;
- modal/sheet widths;
- header heights where Stitch establishes them.

### Elevation

- flat;
- subtle;
- raised;
- overlay;
- modal;
- focus elevation when needed.

Do not create shadow variants per card.

### Motion

- instant;
- fast;
- standard;
- deliberate;
- editorial/marketing;
- easing families;
- reveal distance;
- stagger;
- reduced-motion fallback.

### Layering

Define a finite z-index scale for:

- base content;
- sticky content;
- navigation;
- floating CTA;
- dropdown/popover;
- sheet;
- modal;
- toast;
- critical system overlay.

No `z-index: 9999` improvisation.

---

## 5. Page frame and grid contract

Every surface must use an approved page frame rather than private page widths.

A Stitch extraction must establish, where applicable:

- viewport reference;
- page max width;
- content max width;
- mobile gutter;
- tablet gutter;
- desktop gutter;
- grid column count;
- inter-column gap;
- section width behavior;
- full-bleed media rules;
- text measure;
- safe-area behavior.

### Rules

- A section may be full bleed while its content remains in the shared container.
- Do not create a new max-width for each section.
- Do not center narrow text merely because a component is centered; follow Stitch alignment.
- Do not add wrapper layers only to obtain padding that should come from the section/container system.

---

## 6. Vertical rhythm and spacing contract

Spacing communicates hierarchy and cannot be improvised.

### Mandatory hierarchy

`page > section > block/group > component > element`

Each level uses its own approved token class.

### Rules

- Section spacing cannot be replaced with card padding.
- Component spacing cannot be simulated with repeated `<br>` or empty elements.
- Adjacent surfaces of the same hierarchy use the same spacing category unless Stitch explicitly shows a deliberate exception.
- Nested cards may not multiply outer and inner padding without a separate user intent.
- Mobile spacing is extracted independently; it is not a percentage reduction of desktop spacing.

---

## 7. Button constitution

Buttons are actions, not decoration.

### Approved semantic roles

- `primary`
- `secondary`
- `tertiary/ghost`
- `destructive`
- `icon`
- `link-action` only when the control is semantically an action presented as text

Do not add new button families because a page feels visually empty.

### Mandatory button spec

Every button family must have tokens/specification for:

- height;
- horizontal padding;
- radius;
- typography;
- icon size;
- icon gap;
- border;
- background;
- foreground;
- hover;
- active/pressed;
- focus-visible;
- disabled;
- loading;
- destructive state if applicable;
- mobile full-width behavior when Stitch uses it.

### Behavioral rules

- One decision block should have one dominant primary action.
- Two visually equal primary actions for competing consequences are prohibited.
- Destructive actions cannot masquerade as primary brand actions.
- Icon-only buttons require an accessible name and at least a 44x44 hit area.
- Loading state must preserve button geometry to avoid layout shift.
- Disabled state must not be the only explanation for why an action is unavailable when the user needs remediation.
- Do not place primary actions in remote corners on mobile when the flow expects immediate continuation.

---

## 8. Hero constitution

A hero is the opening communication surface of a marketing page, not a universal card.

### Hero must define

- content hierarchy;
- eyebrow/kicker if present;
- headline measure;
- supporting copy measure;
- primary CTA;
- secondary CTA if approved;
- proof/trust content if approved;
- media role;
- media aspect/crop;
- mobile content order;
- desktop content order;
- entry motion;
- reduced-motion state;
- minimum/maximum vertical behavior.

### Rules

- No decorative copy above the primary proposition unless Stitch contains it.
- Do not force `100vh` if it pushes the key CTA below the mobile fold or conflicts with Stitch.
- Hero imagery cannot reduce text contrast.
- Avoid autoplay video unless explicitly approved and performance/accessibility gates pass.
- Marketing motion cannot delay CTA usability.
- Portal/authenticated product screens do not receive a marketing hero unless Stitch explicitly defines one.

---

## 9. Card constitution

Cards are reserved for meaningful grouping, separation or interaction.

### Allowed card roles

- informational;
- interactive/navigation;
- entity/list item;
- metric/summary;
- selected option;
- form/decision group only when Stitch defines a surface;
- status/exception.

### Rules

- Card-inside-card composition is prohibited by default.
- A border, shadow and filled background may not all be added unless Stitch clearly establishes that treatment.
- Cards within one family share radius, padding, title hierarchy and state behavior.
- Interactive cards need clear hover/focus/pressed states and semantic controls.
- A clickable card cannot hide independent nested actions behind one giant ambiguous click target.
- Mobile entity cards must stay compact and scannable.
- Do not turn every text block into a card.

---

## 10. Typography constitution

Typography is a system, not page-level styling.

### Required styles

- display/hero;
- H1;
- H2;
- H3;
- H4 when justified;
- body large;
- body standard;
- body small;
- label;
- caption/meta;
- button;
- numeric/data when required.

### Rules

- Semantic heading order and visual style are separate concerns; do not skip semantic levels just for size.
- Do not introduce one-off text sizes in components.
- Body text measure must remain readable on desktop.
- Mobile headline size/line-height comes from the mobile Stitch reference, not from CSS scaling math alone.
- Uppercase, tracking and weight are tokenized treatments, not ad hoc emphasis.
- Links must remain recognizable and keyboard accessible.

---

## 11. Forms and StepFlow constitution

Forms are conversion and operational surfaces and receive first-class design treatment.

### Every field family defines

- label;
- optional/required treatment;
- helper text;
- placeholder policy;
- input height;
- internal padding;
- border;
- radius;
- focus;
- hover where relevant;
- filled state;
- disabled/read-only;
- error;
- success only when useful;
- icon/adornment rules;
- message spacing.

### Rules

- Placeholder is never the only label.
- Error messages must explain remediation.
- Mobile inputs cannot use text sizing that triggers unwanted browser zoom.
- First actionable field must be immediately visible after opening a create/edit flow.
- Long/high-friction flows use StepFlow when functionally appropriate.
- One StepFlow screen equals one principal decision.
- Progress indication must reflect real steps and not be decorative.
- Primary continue action remains consistent between steps.
- Back/cancel must not visually compete with continue.
- Submission states must prevent duplicate writes.

---

## 12. Navigation constitution

Navigation must reflect information architecture, not available screen width.

### Surfaces

- public header;
- mobile public navigation;
- portal shell/navigation;
- contextual subnavigation;
- breadcrumbs when appropriate;
- footer navigation.

### Rules

- Mobile navigation is a dedicated composition.
- Primary CTA placement is consistent across comparable public pages.
- Portal navigation must prioritize frequent client tasks and status context.
- Active, hover and focus states must be distinct.
- Do not expose CRM/admin navigation in the client portal.
- Navigation cannot rely on scroll direction tricks that make essential paths unpredictable.

---

## 13. Lists, rows and tables

Operational data must remain scannable.

### Rules

- Desktop table is not automatically the mobile representation.
- On mobile, choose the Stitch-approved row/card/stack pattern.
- Preserve information priority: identity/status/action first, metadata second.
- Secondary metadata remains visually quiet.
- Row actions collapse into a compact menu before creating multiple oversized button rows.
- Sorting/filtering controls remain compact.
- Empty states replace the list body; they do not stack above an empty table shell.

---

## 14. Status, badges and chips

Badges communicate state; chips communicate compact selection/filter/taxonomy.

### Rules

- Semantic status cannot rely on color alone.
- Status colors come from the semantic token family.
- Do not use badges as decoration around normal text.
- Badge/chip radius, height, padding and type style are globally tokenized.
- A filter chip must expose selected/unselected/focus states.

---

## 15. Tabs, segmented controls and accordions

- Use only when Stitch or information architecture justifies them.
- Mobile tabs cannot create hidden horizontal overflow without an explicitly approved scroll affordance.
- Selected state must be obvious beyond color alone where necessary.
- Accordion headings must be real controls with expanded state semantics.
- Do not hide primary conversion content behind accordions to reduce page length artificially.

---

## 16. Overlays: modal, dialog, sheet, popover, menu

### Mobile preference

Use an approved sheet/full-height pattern for dense create/edit/filter flows when it exposes content better than a small centered modal.

### Rules

- Focus trap and restoration are required.
- Escape/back behavior must be predictable.
- Background scroll must be controlled.
- Destructive confirmation uses a dedicated confirmation treatment.
- Popovers are not used for content essential to completing a mobile flow if viewport constraints make them fragile.
- Overlay radius, elevation and backdrop use global tokens.

---

## 17. Alerts, banners, toasts and inline feedback

Roles:

- page alert;
- inline validation;
- transient toast;
- system banner.

### Rules

- Do not use toasts for information the user must retain to continue.
- Error/success feedback must be accessible to assistive technology.
- Do not stack multiple banners explaining the same state.
- System warnings are visually distinct from marketing callouts.

---

## 18. Empty, loading, skeleton, error and forbidden states

Every data-driven surface must define:

- loading;
- empty;
- error;
- forbidden/no access where relevant;
- partial/stale state where relevant.

### Rules

- Skeleton geometry approximates final content and does not introduce severe layout shift.
- Spinners do not replace page structure for long waits unless no structure is knowable.
- Empty state explains the situation and offers at most one dominant next action.
- Error state provides retry/remediation when possible.
- Forbidden state must not leak existence of data the user is not authorized to know about.

---

## 19. Icons

- Use one approved icon language/library per surface unless Stitch explicitly mixes styles.
- Icon sizes are tokenized.
- Stroke/fill treatment is consistent.
- Decorative icons are hidden from assistive technology.
- Functional icon-only controls require accessible names.
- Emoji are not substitutes for product icons unless Stitch intentionally uses them.

---

## 20. Images, photography and media

Priority:

1. approved real Costa Clean media;
2. approved processed Costa Clean derivative;
3. approved new original asset;
4. external/stock only when approved and ownership is clear.

### Rules

- Preserve original assets; generate derivatives.
- Crop follows Stitch.
- `object-position` may be screen-local when required to preserve composition.
- Use responsive image sizes/formats.
- Important text is not baked into raster images.
- Decorative media cannot become the accessible name of content.
- No image substitution merely because it is visually similar when Stitch references a specific brand asset.

---

## 21. Dividers, borders, backgrounds and decorative surfaces

- Use global border tokens.
- Do not add dividers where spacing already establishes grouping.
- Decorative gradients/textures/shapes require Stitch evidence.
- Public marketing decoration may be expressive; portal decoration remains subordinate to tasks.
- Background sections must not create unnecessary card-on-card layering.

---

## 22. CTAs: WhatsApp, phone, quote and contact

- CTA hierarchy is consistent across public pages.
- WhatsApp and phone actions must be valid, measurable and accessible.
- A floating WhatsApp control, if Stitch includes one, must respect safe areas and never cover primary actions/forms/cookie controls.
- Pre-filled WhatsApp copy may vary by page context without changing the visual component family.
- Marketing CTA components do not appear inside authenticated portal financial/private-data surfaces without explicit product reason.

---

## 23. Cookie, consent and legal controls

These controls are product UI, not third-party visual debris.

- Consent UI must use the design system while preserving legal clarity.
- Reject/manage choices cannot be visually hidden through misleading hierarchy.
- Cookie overlays cannot obstruct critical content permanently.
- Legal links remain readable and reachable on mobile.

---

## 24. Portal-specific visual rules

The client portal uses the same brand tokens but a calmer interaction layer.

- No large editorial motion on routine tasks.
- No scroll-pinned storytelling.
- Operational density beats decorative whitespace when the client is completing a task.
- Profile, properties, services, requests and invoices remain compact and scannable.
- Financial/document actions are explicit and separated from mutable actions.
- Security/authorization state is clear without exposing implementation details.
- Portal content never inherits public marketing tracking that would leak private behavior/PII.

---

## 25. Marketing-specific visual rules

Public pages may use the more expressive Stitch/GSAP system.

Allowed only when Stitch supports it:

- masked reveals;
- editorial typography motion;
- image reveals;
- subtle parallax;
- pinned storytelling;
- staged section entrances.

All marketing motion must satisfy:

- CTA immediately usable;
- no scroll hijacking;
- no CLS caused by reveal setup;
- reduced-motion fallback;
- mobile performance gate;
- no delay to reading/navigation.

---

## 26. Breakpoints and interpolation

Breakpoints are implementation tools, not sources of design truth.

- Use the minimum number of breakpoints needed to reproduce the supplied Stitch states cleanly.
- Do not add breakpoint-specific visual redesigns absent from Stitch unless required to prevent overflow or accessibility failure.
- `390x844`, `768x1024`, and `1440x900` are mandatory QA anchors, not necessarily CSS breakpoint values.
- Test between anchors for interpolation failures.

---

## 27. Accessibility is part of visual fidelity

Target: WCAG 2.2 AA quality practices.

Mandatory:

- semantic structure;
- keyboard navigation;
- focus-visible;
- sufficient contrast;
- accessible names;
- error identification;
- reduced motion;
- 200% zoom usability for critical flows;
- touch target discipline;
- no color-only meaning;
- logical reading order after responsive rearrangement.

A visually exact implementation that fails critical accessibility is not a faithful production implementation.

---

## 28. Component state completeness

A component is not complete after matching its default screenshot.

Where relevant it must define:

- default;
- hover;
- focus-visible;
- active/pressed;
- selected;
- disabled;
- loading;
- success;
- warning;
- error;
- empty;
- read-only;
- mobile;
- tablet;
- desktop;
- reduced motion.

Only implement states that are semantically applicable, but never omit a required state because Stitch shows only the default frame.

---

## 29. Design extraction protocol

For each new Stitch reference:

1. register reference in `docs/stitch/DESIGN.md`;
2. record exact viewport/capture scale;
3. identify shared vs screen-local decisions;
4. extract tokens only from repeated/system-level decisions;
5. extract component anatomy and states;
6. extract mobile ordering independently;
7. map media to `LEGACY_MEDIA_INVENTORY.md` or mark `ASSET_REQUIRED`;
8. implement/update tokens;
9. implement shared component;
10. implement screen composition;
11. perform visual QA at exact reference viewport;
12. document differences;
13. only then mark the screen `PASS`.

Do not infer undocumented design decisions and label them Stitch-approved.

---

## 30. Token lock and change control

Once a token/component is approved from Stitch and used by more than one production surface, it becomes **LOCKED**.

Changing a locked token requires:

- a new/revised Stitch reference or explicit design approval;
- identification of all affected components/screens;
- before/after visual QA;
- mobile regression first;
- update to `DESIGN.md`;
- update to visual QA evidence;
- normal lint/test/build gates.

Do not change global radius, spacing, typography or button geometry to fix one page locally.

---

## 31. No visual drift rule

The following are design regressions unless explicitly approved:

- new radius value;
- new shadow treatment;
- new button family;
- new card style;
- new form control style;
- new page gutter;
- new type size;
- new icon language;
- new section width;
- new CTA hierarchy;
- new motion language;
- arbitrary responsive rearrangement.

When a page needs something not represented in the system, stop and classify it:

`DERIVABLE_FROM_STITCH` or `WAITING_FOR_STITCH`.

---

## 32. Code enforcement expectations

As implementation progresses, the repository should add automated checks where practical for:

- raw color literals outside token files;
- arbitrary spacing/radius values in reusable components;
- prohibited secret/service-role patterns;
- obvious horizontal-overflow regressions;
- accessibility scans;
- visual regression screenshots;
- reduced-motion coverage;
- mobile viewport E2E.

The absence of an automated lint rule does not make arbitrary styling acceptable.

---

## 33. Visual QA gate

Every final Stitch-backed screen must be recorded in `docs/qa/STITCH_VISUAL_QA.md` with at least:

- reference identifier/revision;
- exact viewport;
- layout fidelity;
- typography fidelity;
- spacing fidelity;
- color fidelity;
- media/crop fidelity;
- control fidelity;
- mobile hierarchy fidelity;
- state coverage;
- motion fidelity;
- reduced-motion behavior;
- accessibility findings;
- unresolved differences;
- verdict.

### Verdicts

- `PASS` — no material visual/UX discrepancy.
- `PASS_WITH_DOCUMENTED_EXCEPTION` — only a justified accessibility/security/technical exception.
- `PARTIAL` — substantial work remains.
- `WAITING_FOR_STITCH` — reference is missing.
- `FAIL` — implementation diverges materially.

A desktop `PASS` never compensates for a mobile `PARTIAL` or `FAIL`.

---

## 34. Definition of Ready for visual implementation

A screen is ready only when:

- Stitch reference exists for the required primary viewport;
- route/functional contract is known;
- relevant media is identified or explicitly marked `ASSET_REQUIRED`;
- applicable shared component specs are known;
- no unresolved security/backend conflict blocks implementation.

For public marketing and portal screens where mobile is important, the **mobile Stitch reference is required before final approval**.

---

## 35. Definition of Done for design work

A Stitch-backed screen is done only when:

- mobile implementation is faithful;
- tablet interpolation is stable;
- desktop implementation is faithful when a desktop reference exists;
- all applicable states are implemented;
- no arbitrary visual values were introduced;
- design tokens/components are reused correctly;
- keyboard/focus/reduced-motion checks pass;
- visual QA is documented;
- lint passes;
- typecheck/tests required by the slice pass;
- build passes;
- commit and push complete.

---

## 36. Current pending state

Until the first approved Stitch references arrive:

- this constitution is ACTIVE;
- `docs/stitch/DESIGN.md` remains `WAITING_FOR_STITCH` for numeric/aesthetic values;
- architecture, contracts, media audit and test infrastructure may proceed;
- final visual implementation must not be invented;
- first requested references remain HOME desktop + HOME mobile, followed by the agreed screen registry.
