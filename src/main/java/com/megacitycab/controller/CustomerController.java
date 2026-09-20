package com.megacitycab.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.megacitycab.dto.CustomerRegistrationRequest;
import com.megacitycab.dto.CustomerRegistrationResponse;
import com.megacitycab.model.Customer;
import com.megacitycab.service.CustomerService;

import jakarta.validation.Valid;

@RestController
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @PostMapping("/api/customers")
    @ResponseStatus(HttpStatus.CREATED)
    public CustomerRegistrationResponse register(@Valid @RequestBody CustomerRegistrationRequest request) {
        Customer customer = customerService.register(request);
        return new CustomerRegistrationResponse(customer.getRegistrationNo(), customer.getUser().getUsername(),
                customer.getName());
    }
}
