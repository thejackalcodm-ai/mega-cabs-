package com.megacitycab.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.megacitycab.dto.BillRequest;
import com.megacitycab.dto.BillResponse;
import com.megacitycab.service.BillService;

import jakarta.validation.Valid;

@RestController
public class BillController {

    private final BillService billService;

    public BillController(BillService billService) {
        this.billService = billService;
    }

    @PostMapping("/api/bookings/{id}/bill")
    @ResponseStatus(HttpStatus.CREATED)
    public BillResponse generateBill(@PathVariable Long id, @Valid @RequestBody BillRequest request) {
        return new BillResponse(billService.generateBill(id, request));
    }

    @GetMapping("/api/bookings/{id}/bill")
    public BillResponse getBill(@PathVariable Long id) {
        return new BillResponse(billService.getBillForBooking(id));
    }
}
