# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through
[GitHub Security Advisories](https://github.com/krizaka/kachizaka/security/advisories/new) or by e-mail to
**security@krizaka.com**. Do not open a public issue. We acknowledge reports within 72 hours.

## Security model (summary)

- **Accounts**: created by an operator; sign-up is closed by the server (`AUTH_SIGNUP_ENABLED`). Passwords hashed with
  scrypt; a wrong address and a wrong password get the same answer after the same work; sign-in is rate-limited.
- **Sessions**: a random token in an HttpOnly, Secure, SameSite=Lax cookie; the database keeps only its keyed hash.
- **Leagues**: visible to their members only (anyone else gets a 404, the live stream included).
- **Integrity**: sealed rule sets, locked predictions and match facts are protected by database triggers, not only by
  the application; scoring refuses rules that no longer match their seal.
- **External data**: read only through Orazaka's edge with Kachizaka's service key, checked against the connector's contract.
- **Administration**: a session, the ADMIN role and an allowed IP address (none in production by default).
- **HTTP**: Content-Security-Policy `default-src 'self'`, HSTS, `nosniff`, `frame-ancestors 'self'`.
