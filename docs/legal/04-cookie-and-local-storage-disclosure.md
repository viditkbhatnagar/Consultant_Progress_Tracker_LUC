# Cookie & Local Storage Disclosure

> v0.1 — drafted 2026-04-26 · Effective date: `[FILL]` · Last reviewed: 2026-04-26 · Owner: DPO `[FILL]`

## Cookies

The Team Progress Tracker **does not use cookies**. We do not set or read
any HTTP cookie for authentication, tracking, or analytics. There are
no third-party cookies (no Google Analytics, no advertising, no embedded
trackers).

## Browser local storage

To stay signed in, the application stores items in your browser's
`localStorage` (a separate browser feature, not a cookie). This is
necessary for the Platform to work.

| Key | Purpose | Retention | Sensitivity |
|---|---|---|---|
| `token` | The JSON Web Token issued at login. The browser sends it back to the server in an `Authorization: Bearer …` header on every authenticated request. | Until you sign out or your session expires. | High — anyone with this value can act as you until expiry. |
| `user` | A copy of your profile (name, email, role, organization, team) so the UI can render without an extra round trip. | Same as above. | High — contains your email and role. |
| `adminOrgScope` | (Admins only) Which tenant filter you last selected in the UI. | Persistent until you change it or clear storage. | Low. |
| `theme_mode` | `light` or `dark`. | Persistent. | None. |
| `commitments_prefs`, `meeting_prefs` (and similar) | Your filter, sort, and column choices on certain pages. | Persistent. | Low. |

## Why we do not use cookies

We chose `localStorage` for the auth token to keep the deployment simple
and avoid the cross-site cookie complexity of our Singapore-app /
Ireland-DB architecture. We acknowledge that `localStorage` is readable
by JavaScript on the same origin and therefore exposed to cross-site
scripting (XSS). We document this trade-off in our
[Security Gap Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md)
under SEC-14 and have a planned migration to HttpOnly cookies.

## How to clear stored items

You can clear `localStorage` at any time:

- Sign out — the application clears `token` and `user`.
- Open your browser's DevTools → Application → Storage → Local Storage,
  and delete entries.
- Use a private / incognito window — `localStorage` for the session is
  discarded when the window closes.

## Consent

The items above are strictly necessary for the Platform to function and
do not require separate consent under PDPL Art. 6 / GDPR Art. 6(1)(b).
We do not use storage for any tracking or marketing purpose.

## Changes

If we ever introduce cookies — for example, to migrate the auth token to
an HttpOnly cookie as planned — we will update this disclosure and the
[Privacy Policy](01-privacy-policy.md) before the change takes effect.

## Related documents

- [Privacy Policy](01-privacy-policy.md)
- [Information Security Policy](../security/01-information-security-policy.md)
- [Security Gap Roadmap](../security/14-security-gap-analysis-and-remediation-roadmap.md)
