# Portal Visual QA Checklist

Date: 2026-08-04

Use this checklist for the portal UI foundation and the CP-3B.2 frontend slice.
The current validation run covered the real profile/property slice and the
mobile-first preview shell.

## Viewports

- 320 × 568
- 375 × 812
- 390 × 844
- 430 × 932
- 768 × 1024
- 1366 × 900

## Required checks

- no horizontal scroll
- safe-area padding on top and bottom
- fixed/bottom navigation does not cover buttons or form messages
- touch targets are at least 44 × 44 px
- inputs use sizes that do not trigger iOS zoom
- focus is visible and lands on the expected element
- reduced motion removes or minimizes non-essential animation
- keyboard open/close does not hide the active action
- orientation change preserves layout
- preview and production share the same shell components

## Auth states

- loading
- login
- recovery
- reset password
- session expired
- no access
- pending review
- suspended
- revoked
- error

## Workspace states

- home
- account
- profile
- properties
- services
- documents
- help
- unavailable or empty

## Profile and properties

- current account context is readable
- profile fields are clearly visible
- property cards remain compact and scannable
- reviewed-change entry is visible without exposing internal IDs
- public property references are visible in cards and detail headers
- empty and unavailable states are neutral
- retry and conflict states are understandable

## Motion

- no scroll hijacking
- no layout shift before first paint
- GSAP-only motion stays subtle
- reduced motion still preserves state clarity
- profile/property screens remain usable at 320, 375, 390, 430, 768 and 1366
