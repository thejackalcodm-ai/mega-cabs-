package com.megacitycab.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.megacitycab.model.Driver;

public interface DriverRepository extends JpaRepository<Driver, Long> {

    Optional<Driver> findByLicenseNo(String licenseNo);
}
