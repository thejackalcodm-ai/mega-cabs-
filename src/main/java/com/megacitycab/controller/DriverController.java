package com.megacitycab.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.megacitycab.dto.DriverRequest;
import com.megacitycab.dto.DriverResponse;
import com.megacitycab.service.DriverService;

import jakarta.validation.Valid;

@RestController
public class DriverController {

    private final DriverService driverService;

    public DriverController(DriverService driverService) {
        this.driverService = driverService;
    }

    @PostMapping("/api/drivers")
    @ResponseStatus(HttpStatus.CREATED)
    public DriverResponse addDriver(@Valid @RequestBody DriverRequest request) {
        return new DriverResponse(driverService.addDriver(request));
    }

    @GetMapping("/api/drivers")
    public List<DriverResponse> listDrivers() {
        return driverService.listDrivers().stream().map(DriverResponse::new).toList();
    }

    @GetMapping("/api/drivers/{id}")
    public DriverResponse getDriver(@PathVariable Long id) {
        return new DriverResponse(driverService.getDriver(id));
    }
}
