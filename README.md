# Mega City Cab — Online Vehicle Reservation System

Coursework project for **CIS6003 Advanced Programming** (Cardiff Metropolitan
University, School of Technologies). Implements a computerised booking and
billing system for the "Mega City Cab" scenario (Colombo), replacing the
manual booking process described in the assessment brief.

> Status: **project foundation only**. This README is updated at every
> milestone to reflect what is genuinely implemented — see the
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

The application starts on `http://localhost:8080`.

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
