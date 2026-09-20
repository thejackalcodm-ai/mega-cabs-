package com.megacitycab.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.model;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import com.megacitycab.dto.VehicleRequest;
import com.megacitycab.exception.DuplicateResourceException;
import com.megacitycab.model.Vehicle;
import com.megacitycab.model.VehicleType;
import com.megacitycab.service.VehicleService;

@WebMvcTest(VehicleWebController.class)
class VehicleWebControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private VehicleService vehicleService;

    @Test
    void listRendersVehiclesView() throws Exception {
        when(vehicleService.listVehicles()).thenReturn(List.of());

        mockMvc.perform(get("/vehicles"))
                .andExpect(status().isOk())
                .andExpect(view().name("vehicles"));
    }

    @Test
    void showFormRendersVehicleFormView() throws Exception {
        mockMvc.perform(get("/vehicles/new"))
                .andExpect(status().isOk())
                .andExpect(view().name("vehicle-form"));
    }

    @Test
    void submitWithValidDataRedirectsToList() throws Exception {
        Vehicle vehicle = new Vehicle("CAB-2233", "Toyota", "Prius", VehicleType.CAR, 4, new BigDecimal("35.00"));
        when(vehicleService.addVehicle(any(VehicleRequest.class))).thenReturn(vehicle);

        mockMvc.perform(post("/vehicles")
                        .param("registrationNo", "CAB-2233")
                        .param("make", "Toyota")
                        .param("model", "Prius")
                        .param("type", "CAR")
                        .param("seatingCapacity", "4")
                        .param("dailyRate", "35.00"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/vehicles"));
    }

    @Test
    void submitWithBlankFieldsRedisplaysFormWithErrors() throws Exception {
        mockMvc.perform(post("/vehicles")
                        .param("registrationNo", "")
                        .param("make", "")
                        .param("model", "")
                        .param("seatingCapacity", "0")
                        .param("dailyRate", ""))
                .andExpect(status().isOk())
                .andExpect(view().name("vehicle-form"))
                .andExpect(model().attributeHasFieldErrors("vehicleRequest", "registrationNo", "make", "model"));
    }

    @Test
    void submitWithDuplicateRegistrationRedisplaysFormWithError() throws Exception {
        when(vehicleService.addVehicle(any(VehicleRequest.class)))
                .thenThrow(new DuplicateResourceException("A vehicle with registration number 'CAB-2233' already exists"));

        mockMvc.perform(post("/vehicles")
                        .param("registrationNo", "CAB-2233")
                        .param("make", "Toyota")
                        .param("model", "Prius")
                        .param("type", "CAR")
                        .param("seatingCapacity", "4")
                        .param("dailyRate", "35.00"))
                .andExpect(status().isOk())
                .andExpect(view().name("vehicle-form"))
                .andExpect(model().attribute("errorMessage", "A vehicle with registration number 'CAB-2233' already exists"));
    }
}
