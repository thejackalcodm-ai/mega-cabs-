# Mega City Cab — Online Vehicle Reservation System

Coursework project for **CIS6003 Advanced Programming** (Cardiff Metropolitan
University, School of Technologies). Implements a computerised booking and
billing system for the "Mega City Cab" scenario (Colombo), replacing the
manual booking process described in the assessment brief.

> Status: **project foundation + JPA domain model (database layer)**. No
> UI, REST API, or business logic exists yet. This README is updated at
> every milestone to reflect what is genuinely implemented — see the
> [traceability matrix](docs/traceability-matrix.md) for the authoritative,
> commit-by-commit status of each assignment requirement.

## Architecture

Layered ("3-tier") Spring Boot application:

```
Presentation (Thymeleaf views / REST controllers)
        |
REST API / Controller layer
        |
Service layer (business logic: booking rules, billing, validation)
        |
Repository layer (Spring Data JPA)
        |
Relational database (H2, file-mode)
```

Justification for these choices, and the design patterns applied at each
layer, are documented in the accompanying academic report and in
[docs/architecture.md](docs/architecture.md) as the project develops.

## Technology stack

| Concern | Choice | Why |
|---|---|---|
| Language / platform | Java 21 | Required by the brief; current LTS |
| Framework | Spring Boot 3.3 | Enables a genuine distributed/web-services architecture, dependency injection, and testability within course timeframe |
| Build tool | Maven | Standard, reproducible builds; used by CI |
| Persistence | Spring Data JPA + H2 (file mode) | Proper relational database with zero external setup for markers; migration path to MySQL/PostgreSQL documented below |
| View layer | Thymeleaf | Server-rendered, menu-driven forms matching the brief's "menu driven application" requirement while remaining a real web application |
| Testing | JUnit 5, Mockito, Spring Boot Test | Industry-standard Java testing stack |
| CI | GitHub Actions | Automated build + test on every push |

## Getting started

Requirements: JDK 21, Maven 3.9+.

```bash
mvn clean install
mvn spring-boot:run
```

The application starts on `http://localhost:8080`. Run `mvn test` to run
the automated test suite (5 tests: context load + 4 repository persistence
tests) against an embedded H2 database.

### Running on your local network

The app binds to all interfaces by default (no `server.address` override),
so once it's running, any device on the same network can reach it at
`http://<your-machine's-LAN-IP>:8080` — no extra configuration needed.

### Public demo access

A permanently-hosted public deployment (Render, Koyeb, etc.) was attempted
for Task D but blocked by each provider's current free-tier requirements
(a card for verification, or no free instance type offered at all) — see
the traceability matrix and the project report for the specific blockers
hit. Until a genuinely free host is found or the small monthly cost is
accepted, the app is demonstrated live via an HTTPS tunnel to a locally
running instance rather than a permanent URL:

```bash
mvn spring-boot:run &
cloudflared tunnel --url http://localhost:8080
```

This prints a temporary public `https://*.trycloudflare.com` URL that
forwards to the local instance for as long as both processes are running —
suitable for a live demo or a time-boxed marker review, not a permanent
deployment. A `Dockerfile` and `render.yaml` are already committed and
ready to use the moment a suitable host is chosen; only a
`Create Service → connect this repo` step remains on that provider's side.

## Configuration

No credentials are committed to this repository. The default H2 file
database requires no configuration. If a MySQL/PostgreSQL profile is added
later, its credentials must be supplied via environment variables or GitHub
Secrets (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`) — never hard-coded or
committed to `application.properties`.

## Project status / roadmap

Development proceeds in controlled, individually tested milestones, each
one a real, buildable commit (no batched or backdated history):

1. **Project foundation** — this commit
2. Database schema / JPA entities
3. Authentication
4. Customer management
5. Vehicle management
6. Driver management
7. Booking management
8. Billing / tax / discount logic
9. Reports
10. REST web services
11. UI refinement
12. Validation & error handling
13. Automated testing consolidation
14. CI/CD
15. Deployment
16. Documentation finalisation

## Documentation

- [docs/traceability-matrix.md](docs/traceability-matrix.md) — assignment requirement → design → implementation → test → commit → evidence → report section
- [docs/architecture.md](docs/architecture.md) — architecture and design pattern rationale (added as implemented)
- Academic report (assessment brief WRIT1) — submitted separately per Cardiff Met's submission process; a link is added here once available, per the brief's requirement to "share the report link within the documentation."

## Module

CIS6003 Advanced Programming — Assessment: *Online Vehicle Reservation
System* (WRIT1), Cardiff Metropolitan University / ICBT Campus, Semester 1,
2024/25.
