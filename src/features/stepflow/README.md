# StepFlow

## Purpose

This folder is the official app entry point for reusable StepFlow primitives.

It does not introduce a second engine.

Current base:

- `src/components/FullscreenStepFlow.tsx`

## What lives here

- `types.ts`
  - canonical shared StepFlow types
- `index.ts`
  - stable re-exports for future flow migrations

## Current rule

New reusable StepFlow work should import shared types from this folder.

Existing productive flows may keep importing `FullscreenStepFlow` from:

- `src/components/FullscreenStepFlow.tsx`

That import remains supported for backwards compatibility.

## Non-goals in this sprint

- no migration of public intake
- no migration of quotes
- no migration of invoices
- no migration of clients, jobs, or finance flows
- no business-logic changes
