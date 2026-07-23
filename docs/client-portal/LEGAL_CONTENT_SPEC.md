# Legal Content Specification

Date: 2026-07-23
Status: drafting specification, pending professional legal approval

## Four separate concepts

| Concept | Function | User action |
| --- | --- | --- |
| Privacy information | informs how personal data is processed | no “accept privacy”; acknowledge availability only when useful |
| Contract acceptance | creates evidence that portal/service terms were accepted | required explicit checkbox/action when contractually necessary |
| Marketing consent | permits optional commercial communications when consent is the basis | separate, optional, unchecked, channel-specific and revocable |
| Cookie consent | controls non-essential terminal storage/access | granular panel; accept/reject/preferences; withdraw anytime |

No checkbox may combine these concepts.

## Required public pages

### Legal notice

Verify and publish:

- legal name/trading name, NIF and full address;
- contact email/phone;
- applicable registry/professional information if any;
- website owner/provider, scope, acceptable use and IP;
- liability/link terms proportionate to mandatory consumer law;
- governing law/jurisdiction without removing mandatory consumer forums;
- version/effective date.

Place a persistent footer link on website and portal.

### Privacy policy, second layer

Sections:

1. controller and privacy contact;
2. scope: website, portal, forms, service, billing, support, security and marketing;
3. purposes, categories, sources and bases in a table;
4. required vs optional fields and consequences;
5. recipients/processors;
6. international transfers and safeguards;
7. retention criteria;
8. rights: access, rectification, erasure, restriction, objection, portability and consent withdrawal where applicable;
9. identity verification, response procedure and AEPD complaint route;
10. automated decisions/profiling: state none unless factual inventory changes;
11. security/account responsibilities without disclosing defensive detail;
12. minors policy;
13. changes, version and effective date.

### Cookie policy

Generated inventory is a starting point, not the whole policy. Include:

- cookie/technology definition;
- strictly necessary basis and exact purpose;
- each optional category/vendor/cookie, controller/third party, purpose, duration and transfer link;
- how to accept, reject, configure and withdraw;
- effect of refusing optional cookies;
- consent retention/review period;
- date of last live scan.

Remove unresolved “varios” entries by classifying or removing the technologies. Verify Google Fonts/Maps, Meta/Instagram/WhatsApp, Burst, Mixpanel-like and WordPress/Elementor cookies against network/cookie evidence.

### Portal terms

Include:

- account eligibility and invitation/approval;
- authorised organisation users and `client_admin` responsibilities;
- credential/MFA/security duties and incident contact;
- permitted/forbidden use;
- content and request accuracy;
- status of portal information and availability;
- invoice document authenticity/copies and no right to edit issued evidence;
- notices and electronic communication;
- suspension, revocation and closure;
- versioned changes and material-change notice;
- applicable law, complaints and mandatory consumer protections.

Do not say that continued use alone accepts a material new term without a reviewed mechanism.

### Service-request and electronic-contracting conditions

Define:

- a request is not a confirmed booking;
- review/quote/confirmation steps;
- service description, price/taxes and payment terms source;
- scheduling and access responsibilities;
- cancellation/rescheduling/no-show rules;
- consumer withdrawal/cancellation rights where applicable and exceptions only after legal review;
- complaint/contact process;
- pre-contract information, downloadable terms, acceptance evidence and confirmation receipt under applicable LSSI/consumer rules.

## First-layer templates

Place next to the submit action, not behind the footer.

### Portal registration

> Responsable: [verified legal identity]. Finalidad: gestionar tu solicitud de acceso y, si se aprueba, tu cuenta de cliente. Base: medidas precontractuales/contrato y las obligaciones aplicables. No vincularemos tu cuenta a un cliente solo por coincidir el email. Destinatarios y transferencias: consulta la información completa. Derechos: [verified contact]. [Política de privacidad].

### Service request

> Usaremos estos datos para revisar y responder tu solicitud de servicio. Enviarla no confirma una reserva. Base: medidas precontractuales/contrato. Conservación, destinatarios y derechos: [Política de privacidad].

### Billing-profile change

> Trataremos el cambio para mantener tus datos contractuales y fiscales. Los cambios sensibles pueden requerir revisión y no alteran facturas ya emitidas. Consulta conservación, destinatarios y derechos en [Política de privacidad].

### Marketing

Separate optional control:

> [ ] Quiero recibir novedades y ofertas de Costa Clean por [email/WhatsApp]. Puedo retirar mi consentimiento en cualquier momento.

Store version, channel, timestamp, user and withdrawal separately. Never require it for portal access or service.

## Acceptance evidence

For terms/contract acceptance store:

- stable document key and semantic version;
- SHA-256 of the exact rendered text;
- effective date and locale;
- user/member/client IDs;
- timestamp and event/request correlation;
- acceptance action and context;
- optional IP pseudonym only if necessary and approved.

Privacy notice display is an information event, not contract acceptance. Cookie proof remains in the consent manager and marketing proof in its own purpose record.

## Account closure and rights content

Explain that closure:

- revokes portal access and sessions;
- cancels pending invites;
- deletes/anonymises optional account data when lawful;
- does not delete invoices, contracts or records under legal hold/statutory retention;
- does not automatically cancel services, settle balances or exercise every GDPR right;
- offers a separate rights request route.

## Content QA

- consistent controller identity/contact across every page;
- Spanish clear-language review and accessible headings/links;
- no pre-ticked optional choices;
- no blanket consent wording;
- version/effective date visible;
- live links from every form/portal footer;
- downloadable or durable copy for contract terms;
- approved translations derived from one canonical version;
- banner behavior matches policy and actual network traffic.
