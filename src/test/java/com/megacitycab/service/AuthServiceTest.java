package com.megacitycab.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.megacitycab.exception.InvalidCredentialsException;
import com.megacitycab.model.Role;
import com.megacitycab.model.User;
import com.megacitycab.repository.UserRepository;

class AuthServiceTest {

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = new BCryptPasswordEncoder();
        authService = new AuthService(userRepository, passwordEncoder);
    }

    @Test
    void authenticateSucceedsWithCorrectCredentials() {
        User user = new User("admin", passwordEncoder.encode("correct-password"), Role.ADMIN);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));

        User authenticated = authService.authenticate("admin", "correct-password");

        assertThat(authenticated.getUsername()).isEqualTo("admin");
        assertThat(authenticated.getRole()).isEqualTo(Role.ADMIN);
    }

    @Test
    void authenticateRejectsWrongPassword() {
        User user = new User("admin", passwordEncoder.encode("correct-password"), Role.ADMIN);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.authenticate("admin", "wrong-password"))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void authenticateRejectsUnknownUsername() {
        when(userRepository.findByUsername("nobody")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.authenticate("nobody", "any-password"))
                .isInstanceOf(InvalidCredentialsException.class);
    }
}
