# QA/bootstrap artifacts

This directory contains schema/reconstruction artifacts for controlled local QA setup. Files here are **not Supabase CLI migrations** and must not be applied or included in Production migration plans.

`20260721_qa_baseline_schema.sql` is a historical public-schema-only baseline. It contains no customer rows, but it is stale and omits managed Auth/Storage state, grants, owners, and sequence state. It is not a complete representation of current QA or Production. Use only from an explicitly isolated bootstrap harness with a synthetic prestate; the local migration preflight checks that it is absent from `supabase/migrations` and verifies its preserved SHA-256.

The reconstruction manifests are descriptive, fail-closed inventories. They do not invoke Supabase CLI, authorize ledger repair, or authorize migrations against QA or Production.
