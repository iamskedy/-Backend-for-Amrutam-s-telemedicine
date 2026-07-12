# Amrutam Telemedicine — Security Checklist & Threat Model

## 1. Data Classification

| Data | Classification | Examples | Handling |
|---|---|---|---|
| Auth secrets | Critical | `password_hash`, `mfa_secret`, refresh token hashes | Hashed/encrypted at rest, never logged, never returned in API responses |
| Health/consultation data | Sensitive (PHI-like) | consultation notes, prescription content, diagnosis | Access-controlled by RBAC + ownership check, encrypted at rest, audit-logged on access/change |
| PII | Sensitive | name, phone, address, DOB, email | Encrypted at rest, access limited to owning user + their doctor + admin |
| Payment metadata | Sensitive | amount, provider ref, status | No raw card/bank data ever touches this system (mock gateway abstraction — a real integration would tokenize via the PSP, never store PANs) |
| Operational | Internal | audit logs, metrics, slot availability | Access-controlled, retained per compliance window |
| Public | Public | doctor name/specialty/rating (verified doctors) | No restriction |

## 2. Attack Surface Analysis

| Surface | Exposure | Primary risks |
|---|---|---|
| `POST /auth/signup`, `/login` | Public, unauthenticated | Credential stuffing, enumeration, brute force |
| `POST /auth/refresh` | Public, unauthenticated (token-bearing) | Refresh token theft/replay |
| `POST /bookings` | Authenticated (PATIENT) | Double-booking race, payment FK integrity, idempotency-key abuse |
| `GET /search/doctors` | Public, unauthenticated | Cache poisoning via unbounded query params, enumeration/scraping |
| `POST /prescriptions*` | Authenticated (DOCTOR) | Authorization bypass (writing prescriptions for consultations not their own) |
| `/admin/analytics/*` | Authenticated (ADMIN) | Privilege escalation if RBAC check is missing/misconfigured |
| Redis (idempotency cache) | Internal, TLS | Cache poisoning if error responses were cached (fixed — see Known Issues Resolved) |
| Dependencies (npm packages) | Supply chain | Known-CVE packages, typosquatting, transitive vulnerabilities |

## 3. OWASP Top 10 — Mitigations Applied

| Risk | Mitigation in this system |
|---|---|
| **A01 Broken Access Control** | RBAC middleware (`requireRole`) gates role-specific routes; ownership checks required on consultation/prescription reads-writes (a patient must own the consultation, a doctor must be its assigned doctor) — **verify this is enforced in every controller**, not just role-gated |
| **A02 Cryptographic Failures** | Passwords hashed (bcrypt/argon2, never reversible); JWTs signed with a strong secret; TLS enforced in transit (`strict-transport-security` header present); sensitive columns candidates for column-level encryption (see §5) |
| **A03 Injection** | Prisma parameterizes all queries — no raw SQL string concatenation observed; Zod validates and coerces all request bodies/params before they reach service logic |
| **A04 Insecure Design** | Booking saga explicitly designed for compensation on failure (§3 of Architecture doc); idempotency enforced at two independent layers so retries can't create inconsistent state |
| **A05 Security Misconfiguration** | Helmet sets CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc. (visible in every response observed during testing); `NODE_ENV` gates dev-only behavior |
| **A06 Vulnerable & Outdated Components** | Requires a dependency-scanning step in CI (`npm audit` / Dependabot / Snyk) — **not yet confirmed wired in**; recommend a scheduled job, not just on-push, since new CVEs land against unchanged code |
| **A07 Identification & Authentication Failures** | MFA (TOTP) supported and enrollable; refresh-token rotation with reuse detection revokes the entire token family on suspected theft; rate limiting present as a dependency (`rate-limiter-flexible`) — **confirm it's actually applied to `/auth/login` and `/auth/mfa/verify-login`**, the two most brute-forceable routes |
| **A08 Software & Data Integrity Failures** | FK constraints enforce referential integrity at the DB layer (the payment/consultation bug this project fixed is a direct example of relying on this); no unsigned/unverified deserialization of user-supplied code observed |
| **A09 Security Logging & Monitoring Failures** | `pino`/`pino-http` structured logging + `audit_logs` table for state-changing actions (booking created, status transitions, doctor verification); Prometheus metrics (`prom-client`) exposed at `/health/metrics` — **confirm alerting rules exist on top of these metrics**, not just collection |
| **A10 Server-Side Request Forgery** | No user-controlled outbound URL fetching observed in current scope (mock payment gateway is internal); if a real PSP integration is added, validate/allowlist outbound hosts |

## 4. Known Issues Found & Resolved During Development

These are included deliberately — a threat model is more credible with real findings than a clean checklist:

1. **Idempotency middleware caching error responses** — a transient or genuine failure (e.g. the FK bug below) got cached as a "successful" idempotent response and replayed for the full 24h TTL, turning a one-time bug into a persistent outage for any client that retried with the same key. **Fixed:** only 2xx responses are now cached.
2. **Idempotency cache key collision risk** — the Redis key was built from `req.path`, which is mount-relative in Express and would collide across different routers sharing a root path. **Fixed:** key now uses `req.originalUrl`.
3. **Payment FK violation (data integrity)** — the booking saga called the payment service with a slot ID before a real consultation existed, guaranteeing a foreign-key violation on every booking. This was caught via the required FK constraint on `Payment.consultationId` doing exactly its job — the DB refused to let bad data in. **Fixed:** consultation is now created (and committed) before payment is attempted.

## 5. Encryption & Key Management

- **At rest:** rely on the managed Postgres provider's storage-level encryption (e.g. AWS RDS/Aurora, GCP Cloud SQL, or equivalent) as the baseline; column-level encryption (e.g. `pgcrypto` or application-layer encryption) recommended specifically for `profiles.address`, `profiles.phone`, `profiles.dob`, and `prescriptions.content` given their PHI/PII classification.
- **In transit:** TLS enforced end-to-end — client↔API (HSTS present), API↔Postgres, API↔Redis (Upstash connection already uses `tls: true` per observed logs).
- **Secrets management:** currently via environment variables (`DATABASE_URL`, `JWT_SECRET`, etc.) per the implementation guidelines — acceptable for this deliverable's scope, but **JWT_SECRET and DB credentials should be rotated on a defined schedule** (e.g. quarterly, or immediately on suspected compromise) and sourced from a managed secrets store (AWS Secrets Manager, Vault, etc.) rather than plain `.env` files in any real deployment beyond local dev.
- **Key rotation for refresh tokens:** already implemented at the protocol level — each refresh rotates the token, and reuse of a revoked token revokes the whole family, which is the correct pattern for detecting token theft without needing manual rotation.

## 6. Audit Trail Coverage

`audit_logs` currently captures actor, action, entity type/id, before/after state, and timestamp. Confirmed write points (per OpenAPI spec): booking creation. **Recommend extending audit writes to also cover:** consultation status transitions, prescription creation/supersede, doctor verification, and MFA enrollment/disablement — these are all state changes with compliance relevance (who completed a consultation, who altered a prescription and when) that should be reconstructable after the fact, not just booking events.

## 7. Dependency Scanning

- `npm audit` should run in CI on every PR at minimum, ideally also on a daily schedule since new CVEs are disclosed against already-merged code.
- Recommend enabling GitHub Dependabot (or equivalent) for automated PRs on vulnerable dependency bumps.
- Given `jsonwebtoken`, `bcryptjs`/`argon2`, and `ioredis` are all security-relevant dependencies in this project, they warrant priority review on any flagged advisory rather than batching with routine dependency updates.

## 8. Rate Limiting & Input Validation

- `rate-limiter-flexible` is present as a dependency — confirm it is actually mounted on `/auth/login`, `/auth/signup`, and `/auth/mfa/verify-login` specifically, since these are the routes most valuable to an attacker running credential-stuffing or MFA-brute-force attempts.
- Zod schemas validate all observed write endpoints (`bookConsultationSchema`, etc.) — continue this pattern for any new endpoint; a route without a Zod schema is a route without input validation.

## 9. Residual Risks / Open Items

- Ownership-check enforcement (a patient can only see their own consultations; a doctor only their own patients') was not directly observed in this review — needs explicit confirmation in each controller, since RBAC alone (role check) does not imply ownership check.
- No WAF / DDoS-layer mitigation discussed — likely delegated to a cloud provider's edge (e.g. Cloudflare, AWS Shield) in a real deployment; should be stated explicitly in the final submission rather than left implicit.
- No mention yet of PII data-retention/right-to-erasure handling for compliance (relevant given health data) — worth a short statement of policy even if manual today.