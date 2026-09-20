package com.megacitycab;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Milestone 1 smoke test: verifies the Spring application context loads
 * successfully (all beans wire up, the embedded database connects). This is
 * intentionally the only test at this milestone - domain-level unit tests
 * (billing, validation, booking, authentication) are added alongside each
 * corresponding feature milestone.
 */
@SpringBootTest
class MegaCityCabApplicationTests {

    @Test
    void contextLoads() {
        // If the Spring context fails to start, this test fails.
    }
}
