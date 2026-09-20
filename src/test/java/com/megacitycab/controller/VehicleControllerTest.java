package com.megacitycab.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.megacitycab.dto.VehicleRequest;
import com.megacitycab.exception.DuplicateResourceException;
import com.megacitycab.exception.ResourceNotFoundException;
import com.megacitycab.model.Vehicle;
import com.megacitycab.model.VehicleType;
import com.megacitycab.service.VehicleService;

@WebMvcTest(VehicleController.class)
class VehicleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private VehicleService vehicleService;

    private static final String VALID_BODY = "{"
            + "\"registrationNo\":\"CAB-2233\","
            + "\"make\":\"Toyota\","
            + "\"model\":\"Prius\","
            + "\"type\":\"CAR\","
            + "\"seatingCapacity\":4,"
            + "\"dailyRate\":35.00}";

    @Test
    void addVehicleWithValidDataReturns201() throws Exception {
        Vehicle vehicle = new Vehicle("CAB-2233", "Toyota", "Prius", VehicleType.CAR, 4, new BigDecimal("35.00"));
        when(vehicleService.addVehicle(any(VehicleRequest.class))).thenReturn(vehicle);

        mockMvc.perform(post("/api/vehicles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.registrationNo").value("CAB-2233"))
                .andExpect(jsonPath("$.status").value("AVAILABLE"));
    }

    @Test
    void addVehicleWithBlankFieldsReturns400() throws Exception {
        String invalidBody = "{\"registrationNo\":\"\",\"make\":\"\",\"model\":\"\",\"seatingCapacity\":0}";

        mockMvc.perform(post("/api/vehicles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    void addVehicleWithDuplicateRegistrationReturns409() throws Exception {
        when(vehicleService.addVehicle(any(VehicleRequest.class)))
                .thenThrow(new DuplicateResourceException("A vehicle with registration number 'CAB-2233' already exists"));

        mockMvc.perform(post("/api/vehicles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isConflict());
    }

    @Test
    void listVehiclesReturnsAll() throws Exception {
        Vehicle vehicle = new Vehicle("CAB-2233", "Toyota", "Prius", VehicleType.CAR, 4, new BigDecimal("35.00"));
        when(vehicleService.listVehicles()).thenReturn(List.of(vehicle));

        mockMvc.perform(get("/api/vehicles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].registrationNo").value("CAB-2233"));
    }

    @Test
    void getVehicleReturns404WhenMissing() throws Exception {
        when(vehicleService.getVehicle(eq(99L))).thenThrow(new ResourceNotFoundException("No vehicle found with id 99"));

        mockMvc.perform(get("/api/vehicles/99"))
                .andExpect(status().isNotFound());
    }
}
