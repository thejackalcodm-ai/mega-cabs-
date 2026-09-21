# Requirements Traceability Matrix

This file is the single source of truth for what has genuinely been done
against the CIS6003 assessment brief. It is updated at every milestone —
never pre-filled ahead of the actual work. "Evidence" only ever names
something that actually exists (a commit hash, a test class, a screenshot
you have actually taken).

| # | Brief requirement | Task | UML/Design | Implementation | Database | Test | Git commit | Evidence | Report section |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Login (username/password) | B | pending | done | done | done | pending | `AuthService` (BCrypt via `spring-security-crypto`) + `AuthController` (`POST /api/auth/login`) + `LoginWebController` (`GET`/`POST /login`, session-based, `GET /logout` invalidates it, nav bar reflects logged-in state via `GlobalModelAttributes`); `AuthServiceTest` (3), `AuthControllerTest` (3), `LoginWebControllerTest` (5) | 7 |
| 2 | Customer registration (reg no, name, address, NIC) | B | pending | done | done | done | pending | `CustomerService` (generates reg no, hashes password, rejects duplicate username/NIC) + `CustomerController` (`POST /api/customers`, JSON) + `RegistrationController` (`GET`/`POST /register`, Thymeleaf form + success page); `CustomerServiceTest` (3), `CustomerControllerTest` (3), `RegistrationControllerTest` (4) | 7 |
| 3 | Add booking (order no, name, address, phone, destination) | B | pending | done | done | done | pending | `BookingService.createBooking` (generates `ORD-` order no, validates customer/vehicle exist, rejects unavailable vehicle, marks vehicle `BOOKED`) + `BookingController` (`POST /api/bookings`) + `BookingWebController` (`GET`/`POST /book` form); `BookingServiceTest` (4), `BookingControllerTest` (5), `BookingWebControllerTest` (6) | 7 |
| 4 | Display booking details | B | pending | done | done | done | pending | `BookingController` (`GET /api/bookings`, `GET /api/bookings/{id}`) + `BookingWebController` (`GET /bookings` list, `GET /bookings/{id}` detail) | 7 |
| 5 | Calculate & print bill (tax/discount) | B | pending | done | done | done | pending | `BillService.generateBill` (10% flat tax, discount deducted, rejects a second bill for the same booking, rejects a discount larger than subtotal+tax) + `BillController` (`POST`/`GET /api/bookings/{id}/bill`) + `BillWebController` (`GET`/`POST /bookings/{id}/bill/new`, `GET /bookings/{id}/bill` printable view); `BillServiceTest` (4), `BillControllerTest` (4), `BillWebControllerTest` (4) | 7 |
| 6 | Vehicle management | B | pending | done | done | done | pending | `VehicleService` (add, list, get-by-id, rejects duplicate registration no) + `VehicleController` (`POST`/`GET /api/vehicles`, `GET /api/vehicles/{id}`) + `VehicleWebController` (`GET /vehicles` list, `GET`/`POST /vehicles/new` form); `VehicleServiceTest` (4), `VehicleControllerTest` (5), `VehicleWebControllerTest` (5) | 7 |
| 7 | Driver management | B | pending | done | done | done | pending | `DriverService` (add, list, get-by-id, rejects duplicate license no) + `DriverController` (`POST`/`GET /api/drivers`, `GET /api/drivers/{id}`) + `DriverWebController` (`GET /drivers` list, `GET`/`POST /drivers/new` form); `DriverServiceTest` (4), `DriverControllerTest` (5), `DriverWebControllerTest` (5) | 7 |
| 8 | Help / usage guidance | B | pending | done | n/a | done | pending | `HelpWebController` (`GET /help`) + `help.html`, a real step-by-step guide (register → login → book → bill → manage fleet), linked from the home page and every page's nav bar; `HelpWebControllerTest` (1) | 7 |
| 9 | Logout / exit | B | pending | done | n/a | done | pending | `LoginWebController.logout` (`GET /logout`) genuinely invalidates the `HttpSession`, not just a redirect — verified by a scripted browser test that logs in, confirms the username in the nav bar, logs out, and confirms the nav reverts to a "Login" link with no residual session state | 7 |
| 10 | Distributed application / web services | B | pending | done | n/a | done | pending | 15 REST endpoints across 6 resources (auth, customer, vehicle, driver, booking, bill) — JSON in/out, proper HTTP status codes (200/201/400/401/404/409) | 6 |
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

**Milestone 7 (this commit):** Booking and billing (requirements 3,
4, 5) — built to the scope explicitly agreed with the user ("Match the
assignment brief closely"): a customer books a specific available
vehicle, staff can then calculate and print a bill for that booking.
No live ride-matching, driver self-registration, or earnings dashboard
— that is a different, out-of-scope application the user considered
and explicitly declined in favour of the brief.

`BookingService.createBooking` looks up the customer by registration
number and the vehicle by id, rejects either if not found
(`ResourceNotFoundException`), rejects the booking outright if the
vehicle is not currently `AVAILABLE` (new `InvalidBookingException`,
mapped to HTTP 409), and — on success — generates an `ORD-<8-char
UUID slice>` order number and flips the vehicle to `BOOKED` in the
same transaction, so a second customer can never double-book it.
`BillService.generateBill` computes a flat 10% tax on the vehicle's
daily rate, subtracts the requested discount, rejects a second bill
against an already-billed booking (`DuplicateResourceException` → 409)
and rejects a discount that would take the total below zero. Both are
exposed as a REST API (`POST`/`GET /api/bookings`,
`POST`/`GET /api/bookings/{id}/bill`) and a Thymeleaf UI (`/book`,
`/bookings`, `/bookings/{id}`, `/bookings/{id}/bill/new`,
`/bookings/{id}/bill` with a print-friendly stylesheet), linked from
the home page and the shared nav.

A template bug was caught during this milestone's own test run before
anything was committed: `bill-view.html` initially referenced
`${bill.orderNo}`, but the model attribute is the raw `Bill` entity,
which has no such property (only `Bill.getBooking().getOrderNo()`
does) — this failed one `BillWebControllerTest` with a genuine
Thymeleaf `SpelEvaluationException` on a clean `mvn test` run. Fixed
to `${bill.booking.orderNo}`; the full suite (77 tests) then passed
with 0 failures/0 errors.

Verified against a freshly packaged jar (not a stale process) with an
end-to-end scripted headless-browser walkthrough covering: registering
a fresh customer and vehicle, confirming the new vehicle appears in
the booking form's available-vehicle dropdown, submitting a booking
and landing on its detail page, confirming that same vehicle
immediately disappears from the available list on a second visit to
`/book`, generating a bill with a discount and confirming the
rendered order number/subtotal/tax/total, confirming a second bill
attempt on the same booking is rejected with a clear inline error
(not a stack trace), and confirming a booking against an unknown
customer registration number fails cleanly. All 16 scripted checks
passed with zero browser console errors. Independently of the app
layer, the resulting H2 database was queried directly
(`org.h2.tools.Shell`) and confirmed: vehicle status `BOOKED`, booking
status `PENDING`, and the bill row showing subtotal `45.00`, tax
`4.50` (10% of 45.00), discount `5.00`, total `44.50` — the arithmetic
is correct in the persisted data, not just on screen.

**Milestone 8 (this commit):** Help and logout (requirements 8, 9),
plus a real UI counterpart for login (requirement 1), which until now
only existed as a REST API with no way for a customer to actually sign
in through the browser. `LoginWebController` adds `GET`/`POST /login`
— a Thymeleaf form that reuses the existing `AuthService`/
`LoginRequest` from the REST API rather than duplicating credential
logic, and on success stores the username/role in the `HttpSession`.
`GET /logout` calls `HttpSession.invalidate()` — a genuine session
teardown, not a cosmetic redirect. A new `GlobalModelAttributes`
(`@ControllerAdvice`) injects the current session username into every
Thymeleaf view without touching each controller individually, so the
shared nav fragment can show "Login" when signed out and the username
plus a "Logout" link when signed in, consistently across every page.
`HelpWebController` adds `GET /help`, a real step-by-step usage guide
(register → login → book → calculate the bill → manage the fleet),
linked from the home page and every page's nav bar.

Verified against a freshly packaged jar with a scripted
headless-browser walkthrough distinct from unit/slice tests:
registering a fresh customer, confirming the login form rejects a
wrong password with a clean inline error (not a stack trace) and
accepts the correct one, confirming the nav bar genuinely reflects the
session (shows the username and a Logout link, no longer shows
"Login") and that this persists across navigating to another page,
then confirming logout actually clears the session — the nav reverts
to "Login" and the username no longer appears anywhere on the page.
Also confirmed a blank login submission redisplays the form with
field errors rather than crashing. All 13 scripted checks passed with
zero browser console errors. A separate sanity pass hit every page in
the app (home, register, login, help, book, bookings, vehicles,
vehicle form, drivers, driver form) and confirmed all return HTTP 200
with no console errors and no horizontal overflow at a 375px mobile
viewport, to make sure the new nav markup didn't regress anything
already shipped.

With this milestone, every functional/code requirement in the brief
(#1–10, #12) that maps to actual application behaviour is implemented,
tested, and live-verified. What remains is documentation-only work:
UML diagrams (#13–15), a written test plan (#17), and the final report
— deliberately deferred, per the user's own explicit instruction, until
they've confirmed the running application works to their satisfaction.
