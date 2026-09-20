package com.megacitycab.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.megacitycab.model.Vehicle;
import com.megacitycab.model.VehicleStatus;

public interface VehicleRepository extends JpaRepository<Vehicle, Long> {

    Optional<Vehicle> findByRegistrationNo(String registrationNo);

    List<Vehicle> findByStatus(VehicleStatus status);
}
