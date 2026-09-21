package com.megacitycab.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.megacitycab.dto.DriverRequest;
import com.megacitycab.exception.DuplicateResourceException;
import com.megacitycab.exception.ResourceNotFoundException;
import com.megacitycab.model.Driver;
import com.megacitycab.repository.DriverRepository;

@Service
public class DriverService {

    private final DriverRepository driverRepository;

    public DriverService(DriverRepository driverRepository) {
        this.driverRepository = driverRepository;
    }

    public Driver addDriver(DriverRequest request) {
        if (driverRepository.findByLicenseNo(request.getLicenseNo()).isPresent()) {
            throw new DuplicateResourceException(
                    "A driver with license number '" + request.getLicenseNo() + "' already exists");
        }

        Driver driver = new Driver(request.getName(), request.getLicenseNo(), request.getPhone());
        return driverRepository.save(driver);
    }

    public List<Driver> listDrivers() {
        return driverRepository.findAll();
    }

    public Driver getDriver(Long id) {
        return driverRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("No driver found with id " + id));
    }
}
