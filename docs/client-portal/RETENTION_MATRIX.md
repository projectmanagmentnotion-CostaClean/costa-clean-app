# Retention Matrix

Date: 2026-07-23
Status: proposed minimum/maximum schedule pending legal and operational approval

Retention begins from the stated trigger, is shortened when the purpose ends, and is extended only by a documented statutory exception, dispute or legal hold. Access restriction is not deletion.

| Record | Active retention | Post-trigger retention | End action | Notes |
| --- | --- | --- | --- | --- |
| Raw invitation token | never persisted | none | discard after message generation | secret must not enter logs |
| Invitation hash | until accept/revoke/expiry; default 72h, max 7d | 90 days for abuse/dispute evidence | delete hash; retain minimal event | no client lookup by email |
| Pending portal application | while under review, target 30 days | max 90 days after no response/rejection | delete or anonymise; retain decision event | applicant can withdraw |
| Active membership | account lifetime | 24 months after revocation/closure | pseudonymise/delete optional fields; retain minimal audit | subject to disputes/legal hold |
| Auth sessions/refresh tokens | session policy | revoke on closure/security event | Auth-managed deletion/expiry | do not duplicate tokens |
| Recovery/OTP token | provider TTL, target <= 1 hour | none | expire/delete | never log raw value |
| Rate-limit key | rolling window | 30 days max for abuse trends | delete | HMAC pseudonym, not raw IP/email |
| Security/auth event | operationally useful window | target 12 months, max 24 months absent incident | delete/anonymise | legitimate-interest assessment required |
| Membership/invite admin audit | relationship lifetime | 6 years after relationship end as proposed dispute/accountability ceiling | restrict then delete/anonymise | confirm with counsel |
| Service-request draft | local/UI draft | 30 days inactivity | delete | avoid server draft unless needed |
| Submitted service request | active workflow | 6 years after service/contract end when contractual evidence; rejected/abandoned target 24 months | restrict then delete/anonymise | legal review may distinguish consumers/businesses |
| Profile/property change request | until resolved | 24 months; 6 years if contractual/fiscal evidence | restrict/delete | fiscal changes linked to evidence |
| Current profile/contact data | customer relationship | delete/anonymise when no longer needed after closure | delete/anonymise | canonical records may have separate obligations |
| Issued invoice, fiscal snapshot and PDF | business/accounting use | at least applicable tax period and commercial retention; operational default 6 years from last book entry | restricted archive then reviewed deletion | Commercial Code Article 30 says six years; tax/special rules or proceedings may require longer |
| Invoice download event | security/support window | 12 months | delete/anonymise | no signed URL/object path |
| Payment evidence | accounting/contract use | align with invoice/accounting retention, default 6 years subject to law | restricted archive then reviewed deletion | account closure does not delete |
| Quote not accepted | commercial lifecycle | target 24 months after expiry/rejection | delete/anonymise | extend if dispute |
| Accepted quote/contract/terms proof | contract lifecycle | default 6 years after end, subject to limitation/consumer rules | restricted archive then reviewed deletion | exact text hash/version retained |
| Privacy notice version/display evidence | while version active | 6 years proposed accountability record | archive then delete | information, not consent |
| Marketing consent/objection | until withdrawal or purpose end | retain minimal proof/objection for applicable claim period, proposed 3 years | suppress and minimise | suppression record may remain to honour objection |
| Cookie consent choice | until change/withdrawal | preference lifetime max 24 months before renewal review | replace/delete | current Complianz 365-day cookies require live configuration review |
| Rights request | until completion | proposed 3 years from closure | restrict then delete | retain only decision/identity evidence necessary |
| Breach/incident case | until remediation | 6 years proposed or longer under legal hold | restricted archive then reviewed deletion | include Article 33 decision record |
| Support ticket | until resolved | target 24 months; longer if contractual dispute | delete/anonymise | no unnecessary invoice body |
| Application/API logs | short operational window | 30-90 days depending purpose | delete/anonymise | no PII payloads |
| Backups | rolling provider schedule | target <= 35 days after primary deletion, except immutable legal backup | expire automatically | restoration must reapply tombstones |

## Legal anchors

- GDPR storage limitation: Article 5(1)(e).
- Invoice conservation: Royal Decree 1619/2012 Article 19 refers to the tax-law period.
- Commercial documentation: Commercial Code Article 30 requires six years from the last book entry.

These anchors do not mean every portal record is retained six years. Each purpose has its own necessity analysis.

## Deletion controls

- scheduled jobs use exact record types/statuses and dry-run reports;
- legal holds override deletion through an explicit case ID and expiry review;
- deleted users cannot cause cascading deletion of invoices or canonical clients;
- audit records replace user IDs with stable pseudonyms when identity is no longer needed;
- backup expiry and restore tombstone replay are tested;
- every retention job produces counts and errors, never data payloads.

## Required owner decisions before CP-5

- confirmed invoice/tax retention with gestor/legal counsel;
- civil/consumer claim periods for accepted and rejected service requests;
- incident/security log period justified by risk;
- processor backup and deletion schedules;
- rights/closure identity verification procedure.
