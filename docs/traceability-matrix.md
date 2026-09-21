# Requirements Traceability Matrix

This file is the single source of truth for what has genuinely been done
against the CIS6003 assessment brief. It is updated at every milestone —
never pre-filled ahead of the actual work. "Evidence" only ever names
something that actually exists (a commit hash, a test class, a screenshot
you have actually taken).

| # | Brief requirement | Task | UML/Design | Implementation | Database | Test | Git commit | Evidence | Report section |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Login (username/password) | B | pending | done | done | done | pending | `AuthService` (BCrypt via `spring-security-crypto`) + `AuthController` (`POST /api/auth/login`); `AuthServiceTest` (3), `AuthControllerTest` (3) | 7 |
| 2 | Customer registration (reg no, name, address, NIC) | B | pending | done | done | done | pending | `CustomerService` (generates reg no, hashes password, rejects duplicate username/NIC) + `CustomerController` (`POST /api/customers`, JSON) + `RegistrationController` (`GET`/`POST /register`, Thymeleaf form + success page); `CustomerServiceTest` (3), `CustomerControllerTest` (3), `RegistrationControllerTest` (4) | 7 |
| 3 | Add booking (order no, name, address, phone, destination) | B | pending | pending | done | done | pending | `Booking` entity + `BookingRepository`; `RepositoryPersistenceTest#bookingLinksCustomerVehicleAndDriver` | 7 |
| 4 | Display booking details | B | pending | pending | done | done | pending | same `Booking` entity/repository as #3 | 7 |
| 5 | Calculate & print bill (tax/discount) | B | pending | pending | done | done | pending | `Bill` entity + `BillRepository`; `RepositoryPersistenceTest#billCalculatesAndPersistsAgainstBooking` | 7 |
| 6 | Vehicle management | B | pending | done | done | done | pending | `VehicleService` (add, list, get-by-id, rejects duplicate registration no) + `VehicleController` (`POST`/`GET /api/vehicles`, `GET /api/vehicles/{id}`) + `VehicleWebController` (`GET /vehicles` list, `GET`/`POST /vehicles/new` form); `VehicleServiceTest` (4), `VehicleControllerTest` (5), `VehicleWebControllerTest` (5) | 7 |
| 7 | Driver management | B | pending | done | done | done | pending | `DriverService` (add, list, get-by-id, rejects duplicate license no) + `DriverController` (`POST`/`GET /api/drivers`, `GET /api/drivers/{id}`) + `DriverWebController` (`GET /drivers` list, `GET`/`POST /drivers/new` form); `DriverServiceTest` (4), `DriverControllerTest` (5), `DriverWebControllerTest` (5) | 7 |
| 8 | Help / usage guidance | B | pending | pending | n/a | pending | pending | pending | 7 |
| 9 | Logout / exit | B | pending | pending | n/a | pending | pending | pending | 7 |
| 10 | Distributed application / web services | B | pending | in progress | n/a | done | pending | Eight real REST endpoints now: auth login, customer registration, and full vehicle/driver CRUD-lite (add/list/get) — JSON in/out, proper HTTP status codes (200/201/400/401/404/409) | 6 |
| 11 | Design patterns | B | pending | in progress | n/a | n/a | pending | Repository pattern applied throughout (6 Spring Data JPA interfaces); Service layer separates business logic from controllers (`AuthService`, `CustomerService`). No named GoF pattern (Strategy/Factory) applied yet — planned for bill tax/discount calculation | 6 |
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

**Milestone 3:** Authentication (requirement 1) — the first vertical
slice through every layer (repository → service → controller → HTTP).
`AuthService` verifies credentials against the existing
`User`/`UserRepository` using BCrypt password hashing
(`spring-security-crypto`, no other Spring Security auto-configuration
pulled in, so no other endpoint is affected). `AuthController` exposes
`POST /api/auth/login`, returning the username/role on success, 401 on
bad credentials, and 400 with field-level messages on invalid input.

**Milestone 4:** Customer registration (requirement 2) — both a REST
API (`POST /api/customers`) and, for the first time, a real UI a human
can click through: a Thymeleaf form at `GET /register`, linked from
the home page, posting to `POST /register` and redirecting to a
confirmation page showing the generated registration number.
`CustomerService` generates the registration number
(`REG-<8-char UUID slice>`, chosen over a sequential counter to avoid
races under concurrent registration), hashes the password, and rejects
a duplicate username or NIC with a clear message rather than a raw
database error — verified against a real duplicate-NIC submission,
not just a mocked test. NIC is validated against actual Sri Lankan NIC
formats (9 digits + V/X, or 12 digits). Everything below was exercised
against a live running instance, not just unit/slice tests: form
submission → success page, duplicate NIC → inline error (no crash),
REST registration, and logging in as the newly created customer via
`POST /api/auth/login`, including a wrong-password 401.

**Milestone 5:** Vehicle management (requirement 6) — `VehicleService`
adds vehicles (defaulting to `AVAILABLE` status), lists them, fetches
one by id, and rejects a duplicate registration number with a
409/inline error rather than a raw database error
(`DuplicateResourceException`, `ResourceNotFoundException` — new,
reusable across future resources rather than customer-specific).
Exposed as both a REST API and a real admin UI, linked from the home
page.

**Milestone 6 (this commit):** Driver management (requirement 7),
built identically to vehicle management for consistency
(`DriverService`/`DriverController`/`DriverWebController`), plus a
genuine UI/UX pass triggered by real user-reported confusion: a
customer hit real (correct) validation failures on `/register`
("invalid password", "invalid NIC") with no clear guidance on what
was actually expected. Fixed by making format hints permanently
visible under each field (not only shown after a failure), trimming
and normalising input server-side (NIC/license number uppercased,
whitespace trimmed) so accidental spacing no longer causes a
confusing rejection, and a full visual redesign: a shared Thymeleaf
nav fragment (`fragments/nav.html`) used by every page so navigation
is consistent and current-page-aware, a dark header/bold rounded CTA
button style, a card-based home menu, status badges on data tables,
and a proper SVG favicon. Verified this time with an exhaustive,
scripted headless-browser walkthrough (not spot checks): the exact
invalid-password/invalid-NIC scenario reported, a corrected resubmit,
vehicle add, driver add, a duplicate-driver-license error, browser
console error monitoring (zero errors), nav active-state checks, and
a mobile-viewport pass (no horizontal scroll) — all against a freshly
rebuilt jar, not a stale process. Status will change to "done"
per-row only once that specific requirement has real code, a passing
test, and a commit hash to point to.
