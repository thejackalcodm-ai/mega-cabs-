# Requirements Traceability Matrix

This file is the single source of truth for what has genuinely been done
against the CIS6003 assessment brief. It is updated at every milestone —
never pre-filled ahead of the actual work. "Evidence" only ever names
something that actually exists (a commit hash, a test class, a screenshot
you have actually taken).

| # | Brief requirement | Task | UML/Design | Implementation | Database | Test | Git commit | Evidence | Report section |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Login (username/password) | B | pending | done | done | done | pending | `AuthService` (BCrypt via `spring-security-crypto`) + `AuthController` (`POST /api/auth/login`); `AuthServiceTest` (3), `AuthControllerTest` (3) | 7 |
| 2 | Customer registration (reg no, name, address, NIC) | B | pending | pending | done | done | pending | `Customer` entity + `CustomerRepository`; `RepositoryPersistenceTest#customerRegistrationPersistsAndLinksToUser` | 7 |
| 3 | Add booking (order no, name, address, phone, destination) | B | pending | pending | done | done | pending | `Booking` entity + `BookingRepository`; `RepositoryPersistenceTest#bookingLinksCustomerVehicleAndDriver` | 7 |
| 4 | Display booking details | B | pending | pending | done | done | pending | same `Booking` entity/repository as #3 | 7 |
| 5 | Calculate & print bill (tax/discount) | B | pending | pending | done | done | pending | `Bill` entity + `BillRepository`; `RepositoryPersistenceTest#billCalculatesAndPersistsAgainstBooking` | 7 |
| 6 | Vehicle management | B | pending | pending | done | done | pending | `Vehicle` entity + `VehicleRepository`; `RepositoryPersistenceTest#vehicleAndDriverManagementPersistIndependently` | 7 |
| 7 | Driver management | B | pending | pending | done | done | pending | `Driver` entity + `DriverRepository`; same test as #6 | 7 |
| 8 | Help / usage guidance | B | pending | pending | n/a | pending | pending | pending | 7 |
| 9 | Logout / exit | B | pending | pending | n/a | pending | pending | pending | 7 |
| 10 | Distributed application / web services | B | pending | in progress | n/a | done | pending | First real REST endpoint: `POST /api/auth/login` (`AuthController`), JSON in/out, proper HTTP status codes (200/401/400) | 6 |
| 11 | Design patterns | B | pending | pending | n/a | n/a | pending | pending | 6 |
| 12 | Proper database | B | pending | done | done | done | pending | 6 JPA entities (`User`, `Customer`, `Vehicle`, `Driver`, `Booking`, `Bill`) with FK relationships, H2-backed, verified by `RepositoryPersistenceTest` (4/4 tests passing) | 6 |
| 13 | Use Case diagram | A | pending | n/a | n/a | n/a | pending | pending | 5 |
| 14 | Class diagram | A | pending | n/a | n/a | n/a | pending | pending | 5 |
| 15 | Sequence diagrams (~3) | A | pending | n/a | n/a | n/a | pending | pending | 5 |
| 16 | Documented assumptions | A | in progress | n/a | n/a | n/a | pending | this README/report | 4 |
| 17 | Test plan / TDD / automation | C | n/a | pending | n/a | pending | pending | pending | 8 |
| 18 | Public Git/GitHub, versioned, workflow, deployment | D | n/a | n/a | n/a | n/a | in progress | pending | 9 |

**Project foundation:** Spring Boot/Maven scaffold created and
build-verified (commit `2e1fe6f1000b6b8a3bb832b83dca0ff138506283`).

**Milestone 2:** JPA domain model added — six entities (`User`,
`Customer`, `Vehicle`, `Driver`, `Booking`, `Bill`) covering every
data-bearing functional requirement, plus a Spring Data repository per
entity and `RepositoryPersistenceTest`, which persists and re-reads each
entity (including all foreign-key relationships) against a real H2
database. Schema/persistence only — no service layer, controllers,
authentication, or UI yet.

**Milestone 3 (this commit):** Authentication (requirement 1) — the
first vertical slice through every layer (repository → service →
controller → HTTP). `AuthService` verifies credentials against the
existing `User`/`UserRepository` using BCrypt password hashing
(`spring-security-crypto`, no other Spring Security auto-configuration
pulled in, so no other endpoint is affected). `AuthController` exposes
`POST /api/auth/login`, returning the username/role on success, 401 on
bad credentials, and 400 with field-level messages on invalid input
(`spring-boot-starter-validation`, already a dependency). Requirement 10
(web services) also moves to "in progress" — it now has its first
genuine REST endpoint. Status will change to "done" per-row only
once that specific requirement has real code, a passing test, and a
commit hash to point to.
