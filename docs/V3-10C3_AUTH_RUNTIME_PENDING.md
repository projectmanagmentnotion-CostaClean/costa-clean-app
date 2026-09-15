# V3-10C3 — AUTHENTICATED RUNTIME PENDING

This is the only remaining replay required to close V3-10C3. Do not start
V3-10C4 before it passes.

## Viewports

- 320x568
- 390x844
- 430x932
- 768x1024
- 1024x1366
- 1280x800
- 1440x900
- 1920x1080

## Surfaces

- Home
- Clients
- Client Workspace (when QA data exists)
- Leads
- Lead Workspace (when QA data exists)
- Properties
- Property Workspace (when QA data exists)
- More/navigation

## Runtime invariants

- production requests: `0`
- QA mutations: `0`
- console errors: `0`
- page errors: `0`
- failed critical requests: `0`
- horizontal overflow: `0`
- broken images: `0`
- visible UUIDs: `0`
- Unicode-as-icon: `0`
- legacy markers: `0`

## Functional replay

- Clients, Leads and Properties search match
- search miss
- clear/restoration
- open workspace
- Back
- hard reload
- deep link
- Client → Property relationship where data permits

## Visual evidence

Capture private/ignored AFTER screenshots at:

- 390x844
- 768x1024
- 1440x900

Compare them against the C3 baseline. Do not commit screenshots containing
customer or QA data.

## Closure gate

- independent `pr-quality-gate`: `PASS`
- update C3 docs and roadmap to `CLOSED / CERTIFIED` only after every item
  above passes
- then commit/push the certification closeout
