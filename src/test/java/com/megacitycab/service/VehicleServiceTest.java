package com.megacitycab.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.megacitycab.dto.VehicleRequest;
import com.megacitycab.exception.DuplicateResourceException;
import com.megacitycab.exception.ResourceNotFoundException;
import com.megacitycab.model.Vehicle;
import com.megacitycab.model.VehicleStatus;
import com.megacitycab.model.VehicleType;
import com.megacitycab.repository.VehicleRepository;

class VehicleServiceTest {

    private VehicleRepository vehicleRepository;
    private VehicleService vehicleService;

    @BeforeEach
    void setUp() {
        vehicleRepository = mock(VehicleRepository.class);
        vehicleService = new VehicleService(vehicleRepository);
    }

    private VehicleRequest validRequest() {
        VehicleRequest request = new VehicleRequest();
        request.setRegistrationNo("CAB-2233");
        request.setMake("Toyota");
        request.setModel("Prius");
        request.setType(VehicleType.CAR);
        request.setSeatingCapacity(4);
        request.setDailyRate(new BigDecimal("35.00"));
        return request;
    }

    @Test
    void addVehicleSavesWithAvailableStatus() {
        when(vehicleRepository.findByRegistrationNo("CAB-2233")).thenReturn(Optional.empty());
        when(vehicleRepository.save(any(Vehicle.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Vehicle vehicle = vehicleService.addVehicle(validRequest());

        assertThat(vehicle.getRegistrationNo()).isEqualTo("CAB-2233");
        assertThat(vehicle.getStatus()).isEqualTo(VehicleStatus.AVAILABLE);
    }

    @Test
    void addVehicleRejectsDuplicateRegistrationNo() {
        when(vehicleRepository.findByRegistrationNo("CAB-2233"))
                .thenReturn(Optional.of(new Vehicle("CAB-2233", "Toyota", "Prius", VehicleType.CAR, 4, BigDecimal.TEN)));

        assertThatThrownBy(() -> vehicleService.addVehicle(validRequest()))
                .isInstanceOf(DuplicateResourceException.class);
    }

    @Test
    void listVehiclesReturnsAllFromRepository() {
        Vehicle vehicle = new Vehicle("CAB-2233", "Toyota", "Prius", VehicleType.CAR, 4, BigDecimal.TEN);
        when(vehicleRepository.findAll()).thenReturn(List.of(vehicle));

        List<Vehicle> vehicles = vehicleService.listVehicles();

        assertThat(vehicles).containsExactly(vehicle);
    }

    @Test
    void getVehicleThrowsWhenMissing() {
        when(vehicleRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> vehicleService.getVehicle(99L))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
