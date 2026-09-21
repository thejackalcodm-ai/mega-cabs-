package com.megacitycab.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.megacitycab.dto.DriverRequest;
import com.megacitycab.exception.DuplicateResourceException;
import com.megacitycab.exception.ResourceNotFoundException;
import com.megacitycab.model.Driver;
import com.megacitycab.model.DriverStatus;
import com.megacitycab.repository.DriverRepository;

class DriverServiceTest {

    private DriverRepository driverRepository;
    private DriverService driverService;

    @BeforeEach
    void setUp() {
        driverRepository = mock(DriverRepository.class);
        driverService = new DriverService(driverRepository);
    }

    private DriverRequest validRequest() {
        DriverRequest request = new DriverRequest();
        request.setName("Kamal Perera");
        request.setLicenseNo("B1234567");
        request.setPhone("0771234567");
        return request;
    }

    @Test
    void addDriverSavesWithAvailableStatus() {
        when(driverRepository.findByLicenseNo("B1234567")).thenReturn(Optional.empty());
        when(driverRepository.save(any(Driver.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Driver driver = driverService.addDriver(validRequest());

        assertThat(driver.getLicenseNo()).isEqualTo("B1234567");
        assertThat(driver.getStatus()).isEqualTo(DriverStatus.AVAILABLE);
    }

    @Test
    void addDriverRejectsDuplicateLicenseNo() {
        when(driverRepository.findByLicenseNo("B1234567"))
                .thenReturn(Optional.of(new Driver("Someone Else", "B1234567", "0779999999")));

        assertThatThrownBy(() -> driverService.addDriver(validRequest()))
                .isInstanceOf(DuplicateResourceException.class);
    }

    @Test
    void listDriversReturnsAllFromRepository() {
        Driver driver = new Driver("Kamal Perera", "B1234567", "0771234567");
        when(driverRepository.findAll()).thenReturn(List.of(driver));

        List<Driver> drivers = driverService.listDrivers();

        assertThat(drivers).containsExactly(driver);
    }

    @Test
    void getDriverThrowsWhenMissing() {
        when(driverRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> driverService.getDriver(99L))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
