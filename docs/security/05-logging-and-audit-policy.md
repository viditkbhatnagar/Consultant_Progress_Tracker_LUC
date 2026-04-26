# Logging & Audit Policy

> v0.1 — drafted 2026-04-26 · Last reviewed: 2026-04-26 · Owner: Engineering lead `[FILL]`

## Scope

What gets logged, where logs go, how long they're kept, and how they may
(and may not) be used.

## Today's logging

### Application logs

- Source: `console.log` / `console.error` calls across the server codebase.
- Sink: Render's stdout/stderr capture (line-based, unstructured).
- Notable pattern: the global error handler at
  [`server/middleware/errorHandler.js:6`](../../server/middleware/errorHandler.js)
  prints the **full Mongoose error object**, which can include filter
  fragments containing personal data. This is a P1 finding (SEC-11).

### Mutation audit (lightweight)

- `Commitment`, `Student`, `Meeting` carry `createdBy` and `lastUpdatedBy`
  ObjectId references.
- Deletions are not tracked (SEC-16).
- The Counter / Counter-key collection is unused.

### Atlas audit

- Atlas's built-in audit features depend on the cluster tier `[FILL]`.
- The DBA can enable database-level auditing; not currently enabled.

### LLM provider logs

- OpenAI and Groq retain request metadata per their API terms. Until DPAs
  are signed (SEC-05), assume their default policy applies.

## Targeted logging additions (planned)

| Event | When | Where | SLA |
|---|---|---|---|
| Failed login (SEC-12) | every 401 from `POST /api/auth/login` | structured log + alert at >5/10 min | P1 |
| Successful login | every 200 from `POST /api/auth/login` | structured log | P2 |
| Password change | `PUT /api/auth/updatepassword` 200 | structured log | P2 |
| Account deactivation | `User.isActive` flips to `false` | structured log + email to admin | P2 |
| `admissionClosed` flip | `Commitment` PUT/PATCH that sets `true` | `AuditLog` collection | P2 |
| Hard delete | any `findByIdAndDelete` | `AuditLog` (SEC-16) | P2 |
| Admin org bypass | `?organization=…` query parameter on any read | `AuditLog` (SEC-18) | P2 |
| Force-reingest | `POST /api/docs-chat/admin/reingest` | structured log | P3 |

## Audit log schema (proposed)

```js
{
  _id: ObjectId,
  actorId: ObjectId,            // User._id
  actorRole: String,
  action: String,               // 'user.deactivate', 'commitment.close-admission', ...
  targetType: String,           // 'User', 'Commitment', ...
  targetId: ObjectId,
  before: Mixed,                // shallow snapshot of relevant fields
  after: Mixed,
  ip: String,
  userAgent: String,
  organization: String,
  createdAt: Date,              // indexed; TTL after retention period
}
```

## Retention

| Log type | Retention | Disposal | Driver |
|---|---|---|---|
| Application logs (Render stdout) | Render-managed `[FILL]` | Render-managed | Render dashboard |
| Atlas audit (when enabled) | Per Atlas cluster tier `[FILL]` | Atlas-managed | DBA |
| Application `AuditLog` (planned) | 7 years | TTL or scheduled purge | DPO + engineering lead |
| `DocsChatLog` | 13 months proposed (currently indefinite — SEC-20) | Scheduled purge | Engineering lead |
| `AIUsage` | 7 years (financial audit) | Scheduled purge | Finance + engineering |
| `ChatConversation` | 1 year proposed (currently indefinite) | Scheduled purge | Engineering lead |
| `QueryCache` | 24 hours (TTL index in place) | Mongo TTL | n/a |

## What must never appear in logs

- Plaintext passwords.
- API keys (`OPENAI_API_KEY`, `GROQ_API_KEY`, `JWT_SECRET`).
- Full `MONGODB_URI` (the password segment must be scrubbed).
- Minors' contact data (names, phones, emails).
- Free-text fields likely to embed personal data (`Commitment.followUpNotes`,
  `Meeting.remarks`, `Student` ContactSchema).

When integrating a structured logger (Winston / pino), configure scrubbers
that redact these by key.

## Log access

| Audience | Access |
|---|---|
| Engineering lead | Full Render log access |
| On-call | Read-only Render log access |
| Security lead | Read-only access to all log surfaces |
| DPO | Read-only access for subject-rights and breach investigations |
| External auditors | Time-boxed access on engagement |

## Use of logs

- Operational debugging.
- Incident response (see [Incident Response Plan](07-incident-response-plan.md)).
- Subject-rights fulfilment under PDPL Art. 13–18 / GDPR Art. 15.
- **Not for** routine staff performance monitoring beyond the role-based
  metrics already surfaced in the app.

## Related documents

- [Information Security Policy](01-information-security-policy.md)
- [Incident Response Plan](07-incident-response-plan.md)
- [Records Retention Schedule](../legal/09-records-retention-schedule.md)
- [Monitoring & Alerting Runbook](../engineering/07-monitoring-and-alerting-runbook.md)
