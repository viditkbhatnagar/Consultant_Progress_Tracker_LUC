# Intellectual Property & Copyright Notice

> v0.1 — drafted 2026-04-26 · Effective date: `[FILL]` · Last reviewed: 2026-04-26 · Owner: Legal counsel `[FILL]`

## Ownership of the Platform

The Team Progress Tracker code, design, layout, and selection /
arrangement of features is owned by `[FILL: registered company name]`
("Learners Education") and protected by copyright laws of the United
Arab Emirates and applicable international treaties. The Platform's
trade marks and logos are the property of Learners Education.

## Programme PDFs

The 16 programme PDFs ingested into the Docs RAG corpus
(`client/public/program-docs/`) remain the property of their respective
programme partners. Learners Education ingests and serves these PDFs
under the licensing arrangements with each partner. Staff with access
must not redistribute or extract content beyond what the Platform's UI
permits (the auth-gated PDF viewer at
[`/pdf-viewer`](../user-guides/07-chat-and-docs-rag-guide.md)).

## Open-source notices

The Platform incorporates third-party open-source software. Selected
material licences (full list in the respective `package.json` files):

### Server (`server/package.json`)

| Package | Version | Licence |
|---|---|---|
| `express` | ^5.1.0 | MIT |
| `mongoose` | ^9.0.0 | MIT |
| `bcryptjs` | ^3.0.3 | MIT |
| `jsonwebtoken` | ^9.0.2 | MIT |
| `helmet` | ^8.1.0 | MIT |
| `cors` | ^2.8.5 | MIT |
| `dotenv` | ^17.2.3 | BSD-2-Clause |
| `express-rate-limit` | ^7.5.1 | MIT |
| `express-validator` | ^7.3.1 | MIT |
| `csv-parser` | ^3.2.0 | MIT |
| `multer` | ^2.1.1 | MIT |
| `xlsx` | ^0.18.5 | Apache-2.0 |
| `pdf-parse` | ^1.1.1 | MIT |
| `tiktoken` | ^1.0.15 | MIT |
| `wink-bm25-text-search` | ^3.1.2 | MIT |
| `groq-sdk` | ^1.1.2 | Apache-2.0 |
| `openai` | ^6.22.0 | Apache-2.0 |

### Client (`client/package.json`)

| Package | Version | Licence |
|---|---|---|
| `react` | ^19.2.0 | MIT |
| `react-dom` | ^19.2.0 | MIT |
| `react-router-dom` | ^7.9.6 | MIT |
| `@mui/material` | ^7.3.5 | MIT |
| `@mui/icons-material` | ^7.3.5 | MIT |
| `@mui/x-date-pickers` | ^8.19.0 | MIT |
| `@emotion/react` / `@emotion/styled` | ^11.x | MIT |
| `axios` | ^1.13.2 | MIT |
| `date-fns` | ^4.1.0 | MIT |
| `framer-motion` | ^12.38.0 | MIT |
| `recharts` | ^3.5.1 | MIT |
| `react-data-grid` | 7.0.0-beta.59 | MIT |
| `react-calendar-heatmap` | ^1.10.0 | MIT |
| `react-markdown` | ^10.1.0 | MIT |
| `remark-gfm` | ^4.0.1 | MIT |
| `file-saver` | ^2.0.5 | MIT |
| `xlsx` | ^0.18.5 | Apache-2.0 |
| `fastest-levenshtein` | ^1.0.16 | MIT |
| `web-vitals` | ^2.1.4 | Apache-2.0 |

The full list (including transitive dependencies and exact licence text)
can be regenerated with `npm ls --all` and
`license-checker --production` against each workspace.

## AI-generated content

Outputs of the AI features are produced by third-party models (OpenAI,
Groq) and may not be copyrightable in all jurisdictions. Learners
Education does not assert copyright in the literal AI output. Staff who
incorporate AI-generated content into business documents are responsible
for verifying its accuracy and originality.

## Trademark / brand use

You may not use Learners Education's, LUC's, Skillhub's, or any
programme partner's marks without prior written consent.

## Reporting infringement

To report alleged copyright infringement on the Platform, contact
`[FILL: legal@…]` with:

- Your contact details.
- A description of the work claimed to be infringed.
- The URL or in-app location of the alleged infringement.
- A statement, under penalty of perjury, that you are authorised to act
  on behalf of the rights holder.

## Related documents

- [Terms of Service](02-terms-of-service.md)
- [Acceptable Use Policy](03-acceptable-use-policy.md)
- [Privacy Policy](01-privacy-policy.md)
