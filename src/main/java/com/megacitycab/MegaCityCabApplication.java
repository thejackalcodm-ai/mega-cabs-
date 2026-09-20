package com.megacitycab;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the Mega City Cab Online Vehicle Reservation System.
 *
 * CIS6003 Advanced Programming - Cardiff Metropolitan University.
 * Built as a layered Spring Boot application: Presentation (Thymeleaf/REST
 * controllers) -> Service layer (business logic) -> Repository layer
 * (Spring Data JPA) -> Relational database (H2).
 */
@SpringBootApplication
public class MegaCityCabApplication {

    public static void main(String[] args) {
        SpringApplication.run(MegaCityCabApplication.class, args);
    }
}
