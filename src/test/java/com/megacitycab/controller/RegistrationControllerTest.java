package com.megacitycab.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.model;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import com.megacitycab.dto.CustomerRegistrationRequest;
import com.megacitycab.exception.DuplicateRegistrationException;
import com.megacitycab.model.Customer;
import com.megacitycab.model.Role;
import com.megacitycab.model.User;
import com.megacitycab.service.CustomerService;

@WebMvcTest(RegistrationController.class)
class RegistrationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CustomerService customerService;

    @Test
    void showFormRendersRegisterView() throws Exception {
        mockMvc.perform(get("/register"))
                .andExpect(status().isOk())
                .andExpect(view().name("register"));
    }

    @Test
    void submitWithValidDataRedirectsToSuccessPage() throws Exception {
        Customer customer = new Customer("REG-ABCD1234", "J. Silva", "12 Galle Road, Colombo", "982761234V");
        customer.setUser(new User("jsilva", "hashed", Role.CUSTOMER));
        when(customerService.register(any(CustomerRegistrationRequest.class))).thenReturn(customer);

        mockMvc.perform(post("/register")
                        .param("username", "jsilva")
                        .param("password", "secret123")
                        .param("name", "J. Silva")
                        .param("address", "12 Galle Road, Colombo")
                        .param("nic", "982761234V"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/register/success"));
    }

    @Test
    void submitWithBlankFieldsRedisplaysFormWithErrors() throws Exception {
        mockMvc.perform(post("/register")
                        .param("username", "")
                        .param("password", "")
                        .param("name", "")
                        .param("address", "")
                        .param("nic", ""))
                .andExpect(status().isOk())
                .andExpect(view().name("register"))
                .andExpect(model().attributeHasFieldErrors("customerRegistrationRequest",
                        "username", "password", "name", "address", "nic"));
    }

    @Test
    void submitWithDuplicateNicRedisplaysFormWithErrorMessage() throws Exception {
        when(customerService.register(any(CustomerRegistrationRequest.class)))
                .thenThrow(new DuplicateRegistrationException("A customer with NIC '982761234V' is already registered"));

        mockMvc.perform(post("/register")
                        .param("username", "jsilva")
                        .param("password", "secret123")
                        .param("name", "J. Silva")
                        .param("address", "12 Galle Road, Colombo")
                        .param("nic", "982761234V"))
                .andExpect(status().isOk())
                .andExpect(view().name("register"))
                .andExpect(model().attribute("errorMessage",
                        "A customer with NIC '982761234V' is already registered"));
    }
}
