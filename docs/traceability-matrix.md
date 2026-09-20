# Requirements Traceability Matrix

This file is the single source of truth for what has genuinely been done
against the CIS6003 assessment brief. It is updated at every milestone —
never pre-filled ahead of the actual work. "Evidence" only ever names
something that actually exists (a commit hash, a test class, a screenshot
you have actually taken).

| # | Brief requirement | Task | UML/Design | Implementation | Database | Test | Git commit | Evidence | Report section |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Login (username/password) | B | pending | pending | done | done | pending | `User` entity + `UserRepository`; `RepositoryPersistenceTest` | 7 |
| 2 | Customer registration (reg no, name, address, NIC) | B | pending | pending | done | done | pending | `Customer` entity + `CustomerRepository`; `RepositoryPersistenceTest#customerRegistrationPersistsAndLinksToUser` | 7 |
| 3 | Add booking (order no, name, address, phone, destination) | B | pending | pending | done | done | pending | `Booking` entity + `BookingRepository`; `RepositoryPersistenceTest#bookingLinksCustomerVehicleAndDriver` | 7 |
| 4 | Display booking details | B | pending | pending | done | done | pending | same `Booking` entity/repository as #3 | 7 |
| 5 | Calculate & print bill (tax/discount) | B | pending | pending | done | done | pending | `Bill` entity + `BillRepository`; `RepositoryPersistenceTest#billCalculatesAndPersistsAgainstBooking` | 7 |
| 6 | Vehicle management | B | pending | pending | done | done | pending | `Vehicle` entity + `VehicleRepository`; `RepositoryPersistenceTest#vehicleAndDriverManagementPersistIndependently` | 7 |
| 7 | Driver management | B | pending | pending | done | done | pending | `Driver` entity + `DriverRepository`; same test as #6 | 7 |
| 8 | Help / usage guidance | B | pending | pending | n/a | pending | pending | pending | 7 |
| 9 | Logout / exit | B | pending | pending | n/a | pending | pending | pending | 7 |
| 10 | Distributed application / web services | B | pending | pending | n/a | pending | pending | pending | 6 |
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

**Milestone 2 (this commit):** JPA domain model added — six entities
(`User`, `Customer`, `Vehicle`, `Driver`, `Booking`, `Bill`) covering every
data-bearing functional requirement, plus a Spring Data repository per
entity and `RepositoryPersistenceTest`, which persists and re-reads each
entity (including all foreign-key relationships) against a real H2
database. This is schema/persistence only — no service layer, controllers,
authentication, or UI yet, so "Implementation" stays "pending" for
requirements 1–7 until that logic exists. Status will change to "done"
per-row only once that specific requirement has real code, a passing test,
and a commit hash to point to.
