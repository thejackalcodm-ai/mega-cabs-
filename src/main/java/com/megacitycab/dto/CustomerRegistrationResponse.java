package com.megacitycab.dto;

public class CustomerRegistrationResponse {

    private final String registrationNo;
    private final String username;
    private final String name;

    public CustomerRegistrationResponse(String registrationNo, String username, String name) {
        this.registrationNo = registrationNo;
        this.username = username;
        this.name = name;
    }

    public String getRegistrationNo() {
        return registrationNo;
    }

    public String getUsername() {
        return username;
    }

    public String getName() {
        return name;
    }
}
