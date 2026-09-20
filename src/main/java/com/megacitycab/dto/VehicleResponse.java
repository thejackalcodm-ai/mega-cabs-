package com.megacitycab.dto;

import java.math.BigDecimal;

import com.megacitycab.model.Vehicle;
import com.megacitycab.model.VehicleStatus;
import com.megacitycab.model.VehicleType;

public class VehicleResponse {

    private final Long id;
    private final String registrationNo;
    private final String make;
    private final String model;
    private final VehicleType type;
    private final int seatingCapacity;
    private final BigDecimal dailyRate;
    private final VehicleStatus status;

    public VehicleResponse(Vehicle vehicle) {
        this.id = vehicle.getId();
        this.registrationNo = vehicle.getRegistrationNo();
        this.make = vehicle.getMake();
        this.model = vehicle.getModel();
        this.type = vehicle.getType();
        this.seatingCapacity = vehicle.getSeatingCapacity();
        this.dailyRate = vehicle.getDailyRate();
        this.status = vehicle.getStatus();
    }

    public Long getId() {
        return id;
    }

    public String getRegistrationNo() {
        return registrationNo;
    }

    public String getMake() {
        return make;
    }

    public String getModel() {
        return model;
    }

    public VehicleType getType() {
        return type;
    }

    public int getSeatingCapacity() {
        return seatingCapacity;
    }

    public BigDecimal getDailyRate() {
        return dailyRate;
    }

    public VehicleStatus getStatus() {
        return status;
    }
}
