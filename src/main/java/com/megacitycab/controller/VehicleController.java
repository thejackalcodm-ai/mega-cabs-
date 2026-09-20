package com.megacitycab.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.megacitycab.dto.VehicleRequest;
import com.megacitycab.dto.VehicleResponse;
import com.megacitycab.service.VehicleService;

import jakarta.validation.Valid;

@RestController
public class VehicleController {

    private final VehicleService vehicleService;

    public VehicleController(VehicleService vehicleService) {
        this.vehicleService = vehicleService;
    }

    @PostMapping("/api/vehicles")
    @ResponseStatus(HttpStatus.CREATED)
    public VehicleResponse addVehicle(@Valid @RequestBody VehicleRequest request) {
        return new VehicleResponse(vehicleService.addVehicle(request));
    }

    @GetMapping("/api/vehicles")
    public List<VehicleResponse> listVehicles() {
        return vehicleService.listVehicles().stream().map(VehicleResponse::new).toList();
    }

    @GetMapping("/api/vehicles/{id}")
    public VehicleResponse getVehicle(@PathVariable Long id) {
        return new VehicleResponse(vehicleService.getVehicle(id));
    }
}
