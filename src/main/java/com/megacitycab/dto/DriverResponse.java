package com.megacitycab.dto;

import com.megacitycab.model.Driver;
import com.megacitycab.model.DriverStatus;

public class DriverResponse {

    private final Long id;
    private final String name;
    private final String licenseNo;
    private final String phone;
    private final DriverStatus status;

    public DriverResponse(Driver driver) {
        this.id = driver.getId();
        this.name = driver.getName();
        this.licenseNo = driver.getLicenseNo();
        this.phone = driver.getPhone();
        this.status = driver.getStatus();
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getLicenseNo() {
        return licenseNo;
    }

    public String getPhone() {
        return phone;
    }

    public DriverStatus getStatus() {
        return status;
    }
}
