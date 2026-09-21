package com.megacitycab.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.megacitycab.dto.DriverRequest;
import com.megacitycab.exception.DuplicateResourceException;
import com.megacitycab.exception.ResourceNotFoundException;
import com.megacitycab.model.Driver;
import com.megacitycab.service.DriverService;

@WebMvcTest(DriverController.class)
class DriverControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DriverService driverService;

    private static final String VALID_BODY = "{"
            + "\"name\":\"Kamal Perera\","
            + "\"licenseNo\":\"B1234567\","
            + "\"phone\":\"0771234567\"}";

    @Test
    void addDriverWithValidDataReturns201() throws Exception {
        Driver driver = new Driver("Kamal Perera", "B1234567", "0771234567");
        when(driverService.addDriver(any(DriverRequest.class))).thenReturn(driver);

        mockMvc.perform(post("/api/drivers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.licenseNo").value("B1234567"))
                .andExpect(jsonPath("$.status").value("AVAILABLE"));
    }

    @Test
    void addDriverWithBlankFieldsReturns400() throws Exception {
        String invalidBody = "{\"name\":\"\",\"licenseNo\":\"\"}";

        mockMvc.perform(post("/api/drivers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    void addDriverWithDuplicateLicenseReturns409() throws Exception {
        when(driverService.addDriver(any(DriverRequest.class)))
                .thenThrow(new DuplicateResourceException("A driver with license number 'B1234567' already exists"));

        mockMvc.perform(post("/api/drivers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isConflict());
    }

    @Test
    void listDriversReturnsAll() throws Exception {
        Driver driver = new Driver("Kamal Perera", "B1234567", "0771234567");
        when(driverService.listDrivers()).thenReturn(List.of(driver));

        mockMvc.perform(get("/api/drivers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].licenseNo").value("B1234567"));
    }

    @Test
    void getDriverReturns404WhenMissing() throws Exception {
        when(driverService.getDriver(eq(99L))).thenThrow(new ResourceNotFoundException("No driver found with id 99"));

        mockMvc.perform(get("/api/drivers/99"))
                .andExpect(status().isNotFound());
    }
}
