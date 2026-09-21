package com.megacitycab.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.megacitycab.dto.BillRequest;
import com.megacitycab.exception.DuplicateResourceException;
import com.megacitycab.exception.ResourceNotFoundException;
import com.megacitycab.model.Bill;
import com.megacitycab.model.Booking;
import com.megacitycab.model.Customer;
import com.megacitycab.model.Vehicle;
import com.megacitycab.model.VehicleType;
import com.megacitycab.service.BillService;

@WebMvcTest(BillController.class)
class BillControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private BillService billService;

    private Bill sampleBill() {
        Customer customer = new Customer("REG-1", "Nimal Perera", "Somewhere", "901234567V");
        Vehicle vehicle = new Vehicle("CAB-1", "Toyota", "Prius", VehicleType.CAR, 4, new BigDecimal("100.00"));
        Booking booking = new Booking("ORD-9001", customer, "Nimal Perera", "Somewhere", "0771234567", "Airport",
                vehicle, LocalDate.now());
        return new Bill(booking, new BigDecimal("100.00"), new BigDecimal("10.00"), new BigDecimal("5.00"),
                new BigDecimal("105.00"), LocalDate.now());
    }

    @Test
    void generateBillWithValidDataReturns201() throws Exception {
        when(billService.generateBill(org.mockito.ArgumentMatchers.eq(1L), any(BillRequest.class))).thenReturn(sampleBill());

        mockMvc.perform(post("/api/bookings/1/bill")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"discountAmount\":5.00}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalAmount").value(105.00));
    }

    @Test
    void generateBillWhenAlreadyBilledReturns409() throws Exception {
        when(billService.generateBill(eq(1L), any(BillRequest.class)))
                .thenThrow(new DuplicateResourceException("Booking 'ORD-9001' has already been billed"));

        mockMvc.perform(post("/api/bookings/1/bill")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"discountAmount\":0}"))
                .andExpect(status().isConflict());
    }

    @Test
    void getBillReturns404WhenNotBilled() throws Exception {
        when(billService.getBillForBooking(eq(1L)))
                .thenThrow(new ResourceNotFoundException("Booking 'ORD-9001' has not been billed yet"));

        mockMvc.perform(get("/api/bookings/1/bill"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getBillReturnsExistingBill() throws Exception {
        when(billService.getBillForBooking(eq(1L))).thenReturn(sampleBill());

        mockMvc.perform(get("/api/bookings/1/bill"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderNo").value("ORD-9001"));
    }
}
