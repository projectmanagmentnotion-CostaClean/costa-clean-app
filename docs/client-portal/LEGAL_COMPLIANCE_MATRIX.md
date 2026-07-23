# Legal Compliance Matrix

Date: 2026-07-23
Status: product/legal specification pending professional legal approval

This document is not legal advice and does not state that Costa Clean's texts have professional legal approval. Publication requires verified business facts and review by qualified counsel.

## Applicable baseline

- GDPR: Regulation (EU) 2016/679, especially Articles 5, 6, 7, 12-22, 25, 28, 30, 32-35 and 44-49: <https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32016R0679>
- Spanish LOPDGDD, including layered information in Article 11: <https://www.boe.es/eli/es/lo/2018/12/05/3/con>
- LSSI-CE, including provider information, commercial communications, electronic contracting and Article 22.2 cookies: <https://www.boe.es/eli/es/l/2002/07/11/34/con>
- AEPD layered-information guidance: <https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/6-el-deber-de-informacion>
- AEPD cookies guidance: <https://www.aepd.es/es/documento/guia-cookies.pdf>
- Invoice retention regulation: <https://www.boe.es/eli/es/rd/2012/11/30/1619/con>
- Commercial records retention, Commercial Code Article 30: <https://www.boe.es/eli/es/rd/1885/08/22/(1)/con>

## Control matrix

| Area | Current evidence | Gap / risk | Required specification | Owner / gate |
| --- | --- | --- | --- | --- |
| Legal notice | Public footer has terms/cookies, no verified complete legal notice | controller/NIF/contact/registry and provider facts may be missing or inconsistent | dedicated legal notice with verified identity, NIF, address, contact, activity, applicable registrations/codes and IP terms | Legal + CP-4 |
| Privacy first layer | WPForms home/contact render fields and submit without a visible first layer | data collected without concise point-of-collection information | controller, purpose, basis, recipients summary, retention criterion, rights and full-policy link beside submit | Legal/Web + CP-4 |
| Full privacy policy | Terms link labelled privacy appears broken/inconsistent; no complete policy in footer | Articles 13/14 transparency not reliably met | versioned second layer by purpose, data category/source, basis, recipients, transfers, retention, rights, complaint and automated decisions | Legal + CP-4 |
| Cookie policy | Complianz policy dated 2024; unresolved cookies, stale details and inconsistent contact | policy may not match actual trackers or contacts | fresh scanner/manual inventory; purpose/vendor/duration; strictly necessary exemption; update date and controller data | Legal/Web + CP-4 |
| Consent panel | Accept/Deny/Preferences visible | must verify equal prominence, prior blocking, granular controls and withdrawal | reject as easy as accept, no non-essential tags before consent, granular categories/vendors, persistent settings link and consent proof | Web/Privacy + CP-4 |
| Portal terms | generic website terms claim use implies acceptance | insufficient for account duties and evidence | separate portal terms: eligibility, credentials, authorised users, availability, acceptable use, notices, suspension/closure, IP, liability and versioned acceptance | Legal/Product + CP-3/4 |
| Request/contract conditions | current request language may imply booking | request is not contract/confirmed booking | define request, review, quote, acceptance, price/tax, scheduling, cancellation, consumer rights where applicable, electronic confirmation and records | Legal/Product + CP-3/4 |
| Marketing | no dedicated choice identified in current forms | privacy/contract/cookies could be used as blanket consent | separate optional unchecked choice; purpose/channel/controller; withdrawal; record version and timestamp | Marketing/Privacy + CP-4 |
| Account/membership | no portal | identity/client-linking risk | invitation/manual approval, role notice, account responsibilities, security notices and closure path | Product/Security + CP-2/3 |
| Legal bases | not mapped by operation | blanket consent risk | purpose-by-purpose basis table below; legitimate-interest assessment where used | Privacy + before CP-4 |
| Processors | technical providers known, contracts/regions not verified | Article 28 and transfer uncertainty | processor register, DPA, instructions, TOMs, subprocessor/change notices, deletion/return terms | Controller + before CP-5 |
| International transfers | Vercel/Supabase/other vendor locations not fully verified | Chapter V transfer risk | document region, data flows, adequacy/SCC module, supplementary measures and TIA when required | Privacy/Security + before CP-5 |
| Rights | current cookie page has generic rights and inconsistent contacts | no verified portal procedure | authenticated and non-authenticated intake, identity check, one-month SLA, extension/denial records, secure export and complaint route | Operations + CP-3/4 |
| Retention | no portal matrix | over-retention or unlawful deletion | implement approved matrix, legal holds and deletion/anonymisation jobs with evidence | Privacy/Engineering + CP-2/5 |
| Account closure | not present | mistaken deletion of fiscal evidence | revoke access, end sessions, remove optional profile data when allowed, retain restricted invoices/contracts as required | Support/Finance + CP-3 |
| Security | current CRM Auth exists; portal boundary absent | any-authenticated P0 | explicit tenancy, least privilege, MFA-ready, logging, incident procedure and tests | Security + CP-2 |
| Breach response | no portal procedure evidenced | GDPR 33/34 readiness gap | detection, triage, processor escalation, 72-hour authority decision clock, affected-person assessment, evidence log | Controller/Security + before CP-5 |
| ROPA | no portal-specific record evidenced | Article 30 accountability gap | update processing register for account, service, billing, support, security, marketing and cookies | Controller + before CP-5 |

## Bases by purpose

These are design recommendations subject to factual and professional review:

| Purpose | Candidate basis | Do not do |
| --- | --- | --- |
| Portal account and membership | Article 6(1)(b), contract/pre-contractual steps; Article 6(1)(f) may support limited security administration after assessment | do not call acceptance of privacy information “consent” |
| Service request and delivery | Article 6(1)(b) | do not bundle marketing |
| Billing and invoice evidence | Article 6(1)(b) and 6(1)(c) legal obligations | do not delete when portal account closes |
| Fraud/security/audit logs | Article 6(1)(f), documented legitimate-interest assessment; 6(1)(c) where a specific duty applies | do not store full payloads/IP indefinitely |
| Rights requests | Article 6(1)(c) | do not demand excessive identity evidence |
| Necessary portal session/storage | necessity for requested service; document exact technology | do not classify analytics as necessary |
| Optional analytics/marketing cookies | consent under LSSI/GDPR | no pre-ticked choice or prior placement |
| Email/SMS marketing | consent or a specifically verified existing-customer LSSI basis | no inference from account creation or service request |

## Current public website findings

- WordPress form `2092` collects name, phone, address, email and message; the rendered form did not show privacy information or a privacy acknowledgement.
- Contact and cookie/terms pages show inconsistent email addresses and telephone details.
- Cookie policy states last update 2024 and contains “purpose pending investigation” cookies plus Mixpanel-like names that require actual-use verification.
- Terms are generic/template-like, refer to registration not currently present and rely on implied acceptance. They are not suitable as portal terms or service contracting conditions.
- The app's separate `/quote-request` form requires an “authorization” to prepare a quote but does not identify a linked layered privacy notice in the audited source. Rewrite this as transparent purpose/basis information and keep any optional marketing consent separate.

## Processor/subprocessor register minimum

For each SiteGround, Vercel, Supabase, transactional email, error monitoring, CAPTCHA, WordPress form delivery, AI/API or support provider record:

- legal entity and service;
- controller/processor role;
- categories and data subjects;
- purpose and instructions;
- processing/storage regions;
- DPA date and Article 28 terms;
- subprocessor list/change mechanism;
- international transfer mechanism and assessment;
- security measures, breach notice SLA;
- retention/deletion/export;
- contract owner and review date.

Do not copy a vendor marketing statement into the privacy notice without verifying the actual Costa Clean plan, region and configuration.

## Release blocker

CP-4/CP-5 cannot pass until controller identity and all contact facts are consistent, trackers are measured before/after consent, processor records are verified and every published legal text is marked reviewed by the responsible human. “Pending professional legal approval” remains visible until that review occurs.
