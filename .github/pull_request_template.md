# Summary

- What changed?
- Why was it needed?

# Mandatory Pre-Review Check

- [ ] I read `AGENTS.md` before changing code.
- [ ] I read `docs/UX_APP_MANUAL.md`.
- [ ] I read `docs/CODEX_WORKFLOW.md`.
- [ ] I read `docs/APP_QUALITY_GATES.md`.
- [ ] I read `docs/APP_TRANSFORMATION_ROADMAP.md`.
- [ ] I diagnosed the real current implementation before editing.
- [ ] I defined a plan before editing.
- [ ] I kept the scope small and safe.

# Protected Scope Check

- [ ] I did not change routes unless explicitly requested.
- [ ] I did not touch Supabase unless explicitly requested.
- [ ] I did not change auth unless explicitly requested.
- [ ] I did not change invoices, quotes, clients, services, or critical logic unless explicitly requested.
- [ ] I did not add dependencies.
- [ ] I did not include unrelated refactors.

# UX / StepFlow Check

- [ ] The change follows the modern, minimalist, mobile-first UX direction.
- [ ] The screen keeps one dominant decision.
- [ ] The primary action is clear.
- [ ] StepFlow was used or preserved where the flow requires it.
- [ ] Required UI states were considered.

# Verification

- [ ] `npm run lint`
- [ ] `npm run build`

# Risks / Notes

- List any known risks, constraints, or unverified areas.
