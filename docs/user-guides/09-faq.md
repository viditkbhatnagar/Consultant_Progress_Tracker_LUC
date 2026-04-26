# Frequently Asked Questions

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Product / training lead `[FILL]`

## Account and access

**I can't log in. Help.**
Confirm you typed your email correctly. If the password is right but
you still can't get in, your account may be deactivated. Ask an admin
to confirm `isActive: true` on your `User` row.

**I forgot my password.**
There is no self-service reset today (Gap Roadmap SEC-09). Ask an
admin to set a temporary password and change it on first login.

**I think someone is using my account.**
Tell `[FILL: security@…]` immediately. The admin can deactivate your
account; engineering can rotate `JWT_SECRET` to invalidate any active
session.

**Why is my session so short / so long?**
Sessions live `process.env.JWT_EXPIRE` (default 1 hour). After expiry
you'll be asked to log in again. If you sign out, the token still
exists until expiry — that is a known weakness (Gap Roadmap SEC-10).

## Permissions

**I can't see another team's data — is that a bug?**
No. Team leads see only their own team. Skillhub branches see only
their own branch. That is by design.
([Access Control Policy](../security/02-access-control-policy.md))

**The admin opened my data using `?organization=…` — should I be told?**
Currently, that admin override is not logged (Gap Roadmap SEC-18). Once
SEC-18 lands you can ask the security lead for a list of admin
overrides on your records.

**Why does the Manager only see Students?**
That is the carve-out: Manager has read-only access to student data
across orgs to support reporting needs, and nothing else.

## Daily use

**I closed an admission by mistake. How do I undo it?**
You can't. `admissionClosed: true` is irreversible by design (the
server rejects any attempt to flip it back). Contact admin / engineering
to correct via a database fix; they will document the change.

**Why does my export show 626 fewer LUC student rows than the dashboard?**
Those are the importer-bug rows where `admissionFeePaid = 0`. They are
hidden from every Students-LUC export (and Students with org `'all'`).
See [Export Center Guide](06-export-center-guide.md).

**My export number doesn't match the AI summary.**
The AI summary is generated from a different aggregation and may be
off. Trust the export number; treat the AI as a research aid.

**The chat says "service unavailable". What now?**
Docs RAG's in-memory chunk index didn't load. Ask an admin to force-
reingest from the admin Docs RAG dashboard.

**The chat is rate-limited / pivot says "Too many requests".**
Pivot is rate-limited at 5 / minute / user. Wait a minute and retry.

## Privacy and security

**Where is my data stored?**
Database: MongoDB Atlas in Ireland (EU/EEA). App: Render in Singapore.
AI providers (when used in adult LUC contexts): OpenAI and Groq in the
United States. See [Privacy Policy](../legal/01-privacy-policy.md) §5
and the [Sub-processor List](../legal/06-subprocessor-list.md).

**Does the AI train on my data?**
Per the AI vendors' API terms, content sent to the API is not used to
improve their base models. We are still confirming the formal DPAs
(Gap Roadmap SEC-05); until that is done, treat the answer as "AI
providers may process queries per their published API terms".

**Can I paste a student's name into ChatGPT to summarise it?**
**No.** That is a hard rule under
[Acceptable Use Policy](../legal/03-acceptable-use-policy.md). Use
the in-app chat (which has its own data-processing rules), never
external tools.

**A parent asked for their child's data. What do I do?**
Forward the request to `[FILL: privacy@…]`. The DPO handles parental
rights requests within 30 days. See
[Children's Privacy Notice](../legal/07-childrens-privacy-notice.md).

**A parent wants to delete their child's record.**
Same — forward to `[FILL: privacy@…]`. The DPO will assess whether
deletion is required (it usually is, unless a legal record-keeping
obligation applies).

## Skillhub specifics

**What if a parent hasn't signed the consent form?**
Don't create the student record. Use the
[Parental Consent Form](../legal/08-parental-consent-form.md) and
collect the signature first.

**Why do I need to enter the enrolment number manually?**
Auto-generation was removed in commit c5effc2. The format hint
`SH/IGCSE/26/11/042` is suggested but not enforced. Use the format
that fits your branch's record-keeping.

**Why is the Skillhub chat drawer different from LUC's?**
Docs RAG (programme PDF chat) is LUC-only. Skillhub users see only the
tracker chatbot.

## LUC team-lead specifics

**I want to delete a consultant — they don't work here anymore.**
Use "Deactivate" — it sets `isActive: false`. Their historical
commitments and meetings keep the consultant's name (denormalised). A
hard delete is not exposed in the UI.

**My weekly commitment count went down — why?**
Soft-deleted commitments (`isActive: false`) are filtered out of most
views. Toggle "Show deleted" if your UI exposes it; otherwise, ask
admin.

## Engineering / ops

**How do I get a development environment?**
[Developer Onboarding](../engineering/09-developer-onboarding.md).

**What ports does the app use?**
Server `:5001`, client `:3001`. If `PORT` is unset the server falls
back to `:5000` (gotcha). See
[Architecture Overview](../engineering/01-architecture-overview.md).

**Where is the production data?**
Atlas, Ireland. Don't pull production data to a personal machine.

## Reporting issues

**I think I found a security issue.**
Email `[FILL: security@…]` per the
[Vulnerability Disclosure](../security/15-vulnerability-disclosure.md).

**I have product feedback.**
`[FILL: product@…]` or your usual channel.

## Related documents

- [Onboarding & Quick Start](00-onboarding-and-quick-start.md)
- [Role Permissions Matrix](05-role-permissions-matrix.md)
- [Privacy Policy](../legal/01-privacy-policy.md)
- [Acceptable Use Policy](../legal/03-acceptable-use-policy.md)
