# Vendor & Sub-processor Management

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: DPO `[FILL]` + Engineering lead `[FILL]`

## Purpose

Govern the on-boarding, ongoing assurance, and off-boarding of third-party
vendors that process personal data on Learners Education's behalf or
provide critical infrastructure to the Team Progress Tracker.

## Sub-processor list

The canonical, customer-facing list is at
[`/legal/06-subprocessor-list.md`](../legal/06-subprocessor-list.md). This
document governs the *process* for adding, monitoring, and removing
entries.

Currently engaged:

| Vendor | Service | Region | Personal data sent | DPA status |
|---|---|---|---|---|
| MongoDB Atlas | Primary database | Ireland (`eu-west-1`) | All app data | Standard Atlas DPA `[FILL: signed?]` |
| Render | Application hosting | Singapore (`ap-southeast-1`) | All requests, env-secrets at rest | Standard Render DPA `[FILL: signed?]` |
| OpenAI | LLM analysis, embeddings, Docs-RAG fallback | US | Tool results, queries (may include minors' PII) | `[FILL]` (SEC-05 P0) |
| Groq | Primary LLM for Docs RAG | US | Query + retrieved chunks | `[FILL]` (SEC-05 P0) |

## Onboarding checklist

For any new vendor proposed to receive personal data:

1. **Purpose** — clearly state what the vendor does for us and what data
   it must see.
2. **Necessity & alternatives** — confirm the vendor is the least-data
   option among alternatives.
3. **Contract** — signed Master Services Agreement + DPA (Annex 1–3
   completed).
4. **Region** — note where data will be stored and processed; confirm
   transfer mechanism (SCCs / adequacy / explicit consent).
5. **Security questionnaire** — vendor provides SOC 2 / ISO 27001 report
   (or equivalent) and answers Learners Education's questionnaire
   `[FILL: link]`.
6. **Breach clause** — DPA includes notification within 24-72 hours of
   discovery.
7. **Sub-processor approval** — vendor lists its own sub-processors and
   notifies on changes.
8. **DPO sign-off** — DPO records approval in the vendor register.
9. **Public list update** — Sub-processor List doc updated and
   re-published.

## Ongoing assurance

| Vendor | Annual review | Triggered review |
|---|---|---|
| MongoDB Atlas | DBA confirms cluster tier, region, encryption | On Atlas-published incident |
| Render | Engineering lead confirms region + breach history | On Render-published incident |
| OpenAI | DPO + engineering review usage policy + DPA renewal | On vendor model change or pricing change |
| Groq | Same | Same |

## Off-boarding

When ending engagement:

1. Stop sending data to the vendor in code.
2. Request deletion of any retained data (per DPA termination clause).
3. Rotate API keys / passwords; remove env vars on Render.
4. Update the [Sub-processor List](../legal/06-subprocessor-list.md) and
   notify customers per their DPA.
5. Archive the vendor record and its post-termination evidence.

## Special considerations

### AI vendors (OpenAI, Groq)

- The platform sends **personal data** including minors' contact data to
  these vendors via tool results in the chat drawer (SEC-13).
- Until DPAs are signed (SEC-05) and AI redaction is in place, treat any
  AI feature involving Skillhub data as on hold for production.
- The
  [Children's Privacy Notice](../legal/07-childrens-privacy-notice.md)
  must explicitly disclose AI processing and parental consent must cover
  it.

### Cross-border transfer

UAE → EU/EEA, EU/EEA → Singapore, EU/EEA → US — each has its own legal
basis under PDPL Art. 22-23 and GDPR Art. 44-49. The
[Privacy Policy](../legal/01-privacy-policy.md) discloses each.

## Related documents

- [Sub-processor List](../legal/06-subprocessor-list.md)
- [DPA Template](../legal/05-data-processing-agreement-template.md)
- [Privacy Policy](../legal/01-privacy-policy.md)
- [Information Security Policy](01-information-security-policy.md)
