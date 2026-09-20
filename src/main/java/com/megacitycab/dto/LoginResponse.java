package com.megacitycab.dto;

import com.megacitycab.model.Role;

public class LoginResponse {

    private final String username;
    private final Role role;

    public LoginResponse(String username, Role role) {
        this.username = username;
        this.role = role;
    }

    public String getUsername() {
        return username;
    }

    public Role getRole() {
        return role;
    }
}
