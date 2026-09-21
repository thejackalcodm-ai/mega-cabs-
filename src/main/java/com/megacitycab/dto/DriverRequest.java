package com.megacitycab.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class DriverRequest {

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "License number is required")
    private String licenseNo;

    @Pattern(regexp = "^$|^[0-9+][0-9 -]{6,19}$", message = "Phone number looks invalid")
    private String phone;

    public DriverRequest() {
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name == null ? null : name.trim();
    }

    public String getLicenseNo() {
        return licenseNo;
    }

    public void setLicenseNo(String licenseNo) {
        this.licenseNo = licenseNo == null ? null : licenseNo.trim().toUpperCase();
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone == null ? null : phone.trim();
    }
}
