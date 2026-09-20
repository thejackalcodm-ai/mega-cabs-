package com.megacitycab.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.megacitycab.dto.CustomerRegistrationRequest;
import com.megacitycab.exception.DuplicateRegistrationException;
import com.megacitycab.model.Customer;
import com.megacitycab.model.Role;
import com.megacitycab.model.User;
import com.megacitycab.service.CustomerService;

@WebMvcTest(CustomerController.class)
class CustomerControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CustomerService customerService;

    private static final String VALID_BODY = "{"
            + "\"username\":\"jsilva\","
            + "\"password\":\"secret123\","
            + "\"name\":\"J. Silva\","
            + "\"address\":\"12 Galle Road, Colombo\","
            + "\"nic\":\"982761234V\"}";

    @Test
    void registerWithValidDataReturns201() throws Exception {
        Customer customer = new Customer("REG-ABCD1234", "J. Silva", "12 Galle Road, Colombo", "982761234V");
        customer.setUser(new User("jsilva", "hashed", Role.CUSTOMER));
        when(customerService.register(any(CustomerRegistrationRequest.class))).thenReturn(customer);

        mockMvc.perform(post("/api/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.registrationNo").value("REG-ABCD1234"))
                .andExpect(jsonPath("$.username").value("jsilva"))
                .andExpect(jsonPath("$.name").value("J. Silva"));
    }

    @Test
    void registerWithInvalidNicReturns400() throws Exception {
        String invalidBody = "{"
                + "\"username\":\"jsilva\","
                + "\"password\":\"secret123\","
                + "\"name\":\"J. Silva\","
                + "\"address\":\"12 Galle Road, Colombo\","
                + "\"nic\":\"not-a-nic\"}";

        mockMvc.perform(post("/api/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"));
    }

    @Test
    void registerWithDuplicateNicReturns409() throws Exception {
        when(customerService.register(any(CustomerRegistrationRequest.class)))
                .thenThrow(new DuplicateRegistrationException("A customer with NIC '982761234V' is already registered"));

        mockMvc.perform(post("/api/customers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("A customer with NIC '982761234V' is already registered"));
    }
}
