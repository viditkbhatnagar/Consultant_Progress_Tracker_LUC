# Chat & Docs RAG Guide (LUC)

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Product / training lead `[FILL]`

The chat drawer is the floating bubble at the bottom-right of every
authenticated page. Behind it are **two** separate AI services. Which
one answers your question depends on what you ask and which
organisation your account belongs to.

## What the drawer can do

| Service | Available to | What it answers |
|---|---|---|
| **Tracker chatbot** | admin, team_lead, skillhub | Questions about your own org's data: "How many admissions did Anil close last month?" |
| **Docs RAG** | admin, team_lead (LUC only) | Questions about LUC programmes — fees, modules, eligibility — grounded in our 16 ingested programme PDFs |

The frontend's `classifyQuery` decides per-turn which service answers.
Skillhub users always get the tracker chatbot; their Docs RAG path is
hard-locked off.

## Using the tracker chatbot

1. Click the bubble.
2. Type a natural-language question about commitments, students,
   meetings, or hourly activity in **your scope**.
3. The model uses the read-only tools defined in
   [`server/services/chatTools.js`](../../server/services/chatTools.js)
   to query your data and answer.
4. Results stream into the drawer. Sources, when applicable, render as
   chips at the bottom of the answer.

> The model's tools return **rows of personal data** — names, phones,
> emails of leads / students / consultants — that go into the prompt
> sent to OpenAI. Today, until DPAs are signed, this means staff PII
> and adult-LUC lead PII flow to OpenAI under the standard API terms.
> Skillhub users can use the chatbot but should avoid prompts that
> would surface minors' contact data.

## Using Docs RAG (LUC only)

1. Click the bubble.
2. Ask a programme question, e.g., "What are the entry requirements for
   the Knights College MBA?"
3. The system retrieves the most relevant chunks from the 16 LUC
   programme PDFs and sends them, together with your query, to Groq
   (primary) or OpenAI (fallback).
4. The answer streams back; source chips link to the exact section of
   the relevant PDF in the in-app viewer.
5. Use thumbs-up / thumbs-down to give feedback. We use that to
   prioritise corpus expansion.

[SCREENSHOT: Docs RAG drawer with source chips]

## Source chips and the PDF viewer

- On wide screens, hovering a source chip opens an inline split-pane
  preview of the PDF page.
- On narrow screens, clicking the chip opens
  [`/pdf-viewer`](../../client/src/pages/PdfViewer.js) which streams the
  PDF behind your auth token.
- The PDFs are auth-gated and **LUC-only** at the server.

## Refusals and corpus gaps

If the system can't find a confident answer, it returns a refusal
("I'm not sure / out of scope"). These are logged with `tier: 3` in
`DocsChatLog` and surface in the admin Docs RAG dashboard so the corpus
can be improved.

## Conversation history

Conversations are persisted in `ChatConversation`. Use the left side of
the drawer to switch among prior conversations or to delete one. Today
conversations have **no automated retention purge** (Gap Roadmap
SEC-20); a 1-year purge is in the
[Records Retention Schedule](../legal/09-records-retention-schedule.md).

## Cost

Each AI call counts tokens against `AIUsage`. Admin can see per-user
cost in the AI Usage panel. Repeated identical Docs RAG queries within
24 hours hit the `QueryCache` and cost nothing.

## What you should and should not do

- ✓ Ask about programme content, fees, structure (LUC).
- ✓ Ask about your own org's metrics ("how many … did I do … in …").
- ✗ Paste a student or parent's full name + phone + email and ask the
  AI to "summarise" them. That puts personal data in the prompt
  unnecessarily.
- ✗ Trust the AI's numbers without verifying. Outputs are
  probabilistic.
- ✗ Try to extract embeddings, prompts, or chunks from the system —
  forbidden under the [Acceptable Use Policy](../legal/03-acceptable-use-policy.md).

## Common errors

| Error | Cause | Fix |
|---|---|---|
| "Service unavailable" | Docs RAG index not loaded | Ask admin to force-reingest |
| "I cannot find …" | Refusal — corpus gap | Logged for admin review |
| "Too many requests" | Future rate limit (planned) | Wait a minute |

## Related documents

- [Privacy Policy](../legal/01-privacy-policy.md) §13 (AI features)
- [Acceptable Use Policy](../legal/03-acceptable-use-policy.md)
- [Sub-processor List](../legal/06-subprocessor-list.md)
- [Threat Model](../security/12-threat-model.md) Surface 3
