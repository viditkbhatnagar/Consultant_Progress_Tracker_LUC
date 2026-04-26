# Sub-processor List

> v0.1 — drafted 2026-04-26 · Effective date: `[FILL]` · Last reviewed: 2026-04-26 · Owner: DPO `[FILL]`

This list discloses the third parties that process personal data on
behalf of Learners Education through the Team Progress Tracker. It is
maintained as required by PDPL Art. 23 and GDPR Art. 28(2)–(4).

We update this list whenever a sub-processor is added, replaced, or
removed; material changes are notified by email to customers under any
[Data Processing Agreement](05-data-processing-agreement-template.md) and
on the login screen at least 14 days before they take effect.

## Current sub-processors

| # | Sub-processor | Purpose | Personal data sent | Region | Cross-border safeguard | DPA signed |
|---|---|---|---|---|---|---|
| 1 | **MongoDB, Inc. — Atlas** | Primary database (all tenant data) | All personal data described in [Privacy Policy §3](01-privacy-policy.md) | Ireland (EU/EEA) — `eu-west-1` | EU storage; processor is US-headquartered, EU subsidiary | `[FILL: standard Atlas DPA effective …]` |
| 2 | **Render Services, Inc.** | Application hosting / runtime; receives all in-flight requests; stores environment-secrets at rest on its platform | All personal data in transit; logs containing partial query data | Singapore (`ap-southeast-1`) | `[FILL: SCCs Module 2 / Render DPA effective …]` | `[FILL]` |
| 3 | **OpenAI, L.L.C.** | LLM analysis (`gpt-4o`, `gpt-4o-mini`), embeddings (`text-embedding-3-small`), Docs-RAG fallback | Tool results (may include lead, student, consultant names, contact details, free-text notes); Docs-RAG queries; embeddings of program-document chunks | United States | `[FILL: OpenAI API DPA / Standard Contractual Clauses Module 2; status pending — see SEC-05]` | **No, pending — P0** ([Gap Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md) SEC-05) |
| 4 | **Groq, Inc.** | Primary LLM for in-app document chat (`llama-3.3-70b-versatile`) | Docs-RAG queries; retrieved program-document chunk text; system prompts | United States | `[FILL: SCCs Module 2 / Groq DPA; status pending — see SEC-05]` | **No, pending — P0** (SEC-05) |

## Data flow narrative

A typical request from a Learners Education staff user:

1. Browser (UAE) → **Render Singapore**: HTTPS request with JWT.
2. **Render Singapore** → **MongoDB Atlas Ireland**: TLS-encrypted query
   for the data needed.
3. (Optional) **Render Singapore** → **OpenAI** or **Groq** in the United
   States: prompt and tool results.
4. Response back through the same hops.

This means every request that involves AI features touches **four
jurisdictions**.

## Specifically about AI providers

The risks of sending personal data — especially data concerning **minors**
in our Skillhub branches — to the United States are significant. Until
we (a) confirm DPAs with OpenAI and Groq, (b) reduce the data sent to
LLMs to the minimum required for the answer, and (c) explicitly cover
AI processing in parental consent for Skillhub students, the AI
features should be considered restricted to LUC adult contexts. See:

- [Security Gap Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md)
  SEC-05 (DPAs unsigned) and SEC-13 (data sent to LLMs).
- [Children's Privacy Notice](07-childrens-privacy-notice.md).
- [Threat Model](../security/12-threat-model.md) Surface 3.

## Sub-processors not currently engaged but reserved

None today. The Platform does **not** use:

- Email / SMS / messaging providers (no transactional email is sent yet).
- Cloud object storage (S3, GCS, Cloudinary).
- Web analytics (Mixpanel, Segment, Amplitude, PostHog).
- OAuth / SSO providers.
- Error-tracking SaaS (Sentry, etc.) — recommended in
  [Monitoring Runbook](../engineering/07-monitoring-and-alerting-runbook.md).

When any of these are added, this list is updated and customers are
notified.

## How customers can object to a sub-processor

Customers under a signed DPA can object to a new sub-processor within
**14 days** of notification by giving notice to `[FILL: privacy@…]`.
Where we cannot reasonably accommodate the objection, the customer may
terminate the affected service.

## Change log

| Date | Change |
|---|---|
| 2026-04-26 | Initial draft listing four current sub-processors |

## Related documents

- [Privacy Policy](01-privacy-policy.md)
- [Children's Privacy Notice](07-childrens-privacy-notice.md)
- [Data Processing Agreement (Template)](05-data-processing-agreement-template.md)
- [Vendor & Sub-processor Management](../security/08-vendor-and-subprocessor-management.md)
