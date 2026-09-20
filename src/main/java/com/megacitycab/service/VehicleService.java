package com.megacitycab.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.megacitycab.dto.VehicleRequest;
import com.megacitycab.exception.DuplicateResourceException;
import com.megacitycab.exception.ResourceNotFoundException;
import com.megacitycab.model.Vehicle;
import com.megacitycab.repository.VehicleRepository;

@Service
public class VehicleService {

    private final VehicleRepository vehicleRepository;

    public VehicleService(VehicleRepository vehicleRepository) {
        this.vehicleRepository = vehicleRepository;
    }

    public Vehicle addVehicle(VehicleRequest request) {
        if (vehicleRepository.findByRegistrationNo(request.getRegistrationNo()).isPresent()) {
            throw new DuplicateResourceException(
                    "A vehicle with registration number '" + request.getRegistrationNo() + "' already exists");
        }

        Vehicle vehicle = new Vehicle(request.getRegistrationNo(), request.getMake(), request.getModel(),
                request.getType(), request.getSeatingCapacity(), request.getDailyRate());
        return vehicleRepository.save(vehicle);
    }

    public List<Vehicle> listVehicles() {
        return vehicleRepository.findAll();
    }

    public Vehicle getVehicle(Long id) {
        return vehicleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("No vehicle found with id " + id));
    }
}
