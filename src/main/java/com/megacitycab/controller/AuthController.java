package com.megacitycab.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.megacitycab.dto.LoginRequest;
import com.megacitycab.dto.LoginResponse;
import com.megacitycab.model.User;
import com.megacitycab.service.AuthService;

import jakarta.validation.Valid;

@RestController
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/api/auth/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        User user = authService.authenticate(request.getUsername(), request.getPassword());
        return new LoginResponse(user.getUsername(), user.getRole());
    }
}
