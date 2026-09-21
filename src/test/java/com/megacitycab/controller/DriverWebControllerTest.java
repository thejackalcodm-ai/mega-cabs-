package com.megacitycab.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.model;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import com.megacitycab.dto.DriverRequest;
import com.megacitycab.exception.DuplicateResourceException;
import com.megacitycab.model.Driver;
import com.megacitycab.service.DriverService;

@WebMvcTest(DriverWebController.class)
class DriverWebControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DriverService driverService;

    @Test
    void listRendersDriversView() throws Exception {
        when(driverService.listDrivers()).thenReturn(List.of());

        mockMvc.perform(get("/drivers"))
                .andExpect(status().isOk())
                .andExpect(view().name("drivers"));
    }

    @Test
    void showFormRendersDriverFormView() throws Exception {
        mockMvc.perform(get("/drivers/new"))
                .andExpect(status().isOk())
                .andExpect(view().name("driver-form"));
    }

    @Test
    void submitWithValidDataRedirectsToList() throws Exception {
        Driver driver = new Driver("Kamal Perera", "B1234567", "0771234567");
        when(driverService.addDriver(any(DriverRequest.class))).thenReturn(driver);

        mockMvc.perform(post("/drivers")
                        .param("name", "Kamal Perera")
                        .param("licenseNo", "B1234567")
                        .param("phone", "0771234567"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/drivers"));
    }

    @Test
    void submitWithBlankFieldsRedisplaysFormWithErrors() throws Exception {
        mockMvc.perform(post("/drivers")
                        .param("name", "")
                        .param("licenseNo", "")
                        .param("phone", ""))
                .andExpect(status().isOk())
                .andExpect(view().name("driver-form"))
                .andExpect(model().attributeHasFieldErrors("driverRequest", "name", "licenseNo"));
    }

    @Test
    void submitWithDuplicateLicenseRedisplaysFormWithError() throws Exception {
        when(driverService.addDriver(any(DriverRequest.class)))
                .thenThrow(new DuplicateResourceException("A driver with license number 'B1234567' already exists"));

        mockMvc.perform(post("/drivers")
                        .param("name", "Kamal Perera")
                        .param("licenseNo", "B1234567")
                        .param("phone", "0771234567"))
                .andExpect(status().isOk())
                .andExpect(view().name("driver-form"))
                .andExpect(model().attribute("errorMessage", "A driver with license number 'B1234567' already exists"));
    }
}
