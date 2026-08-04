# QA Legacy Synthetic Data Cleanup

Date: 2026-08-04

This document records the cleanup of obvious legacy synthetic residue from the
portal frontend implementation path.

## Cleaned or replaced in the current slice

- sprint-marker naming in preview-facing portal data
- legacy `cp3b1` / `cp3b2` preview labels in portal preview sources
- synthetic property/profile labels that implied hidden QA identifiers
- preview route and card labels that exposed internal IDs instead of public
  references

## Current preview-safe conventions

- preview clients use neutral labels
- preview properties use public references such as `ref-*`
- reviewed-change receipts use public references only
- property routes use public references in the path

## Non-goals

- No remote data cleanup was performed.
- No production, QA or WordPress records were modified.
- No schema, policy or auth mutation was made.

