package com.megacitycab.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.model;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import com.megacitycab.dto.BillRequest;
import com.megacitycab.exception.DuplicateResourceException;
import com.megacitycab.model.Bill;
import com.megacitycab.model.Booking;
import com.megacitycab.model.Customer;
import com.megacitycab.model.Vehicle;
import com.megacitycab.model.VehicleType;
import com.megacitycab.service.BillService;
import com.megacitycab.service.BookingService;

@WebMvcTest(BillWebController.class)
class BillWebControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private BillService billService;

    @MockBean
    private BookingService bookingService;

    private Booking sampleBooking() {
        Customer customer = new Customer("REG-1", "Nimal Perera", "Somewhere", "901234567V");
        Vehicle vehicle = new Vehicle("CAB-1", "Toyota", "Prius", VehicleType.CAR, 4, new BigDecimal("100.00"));
        return new Booking("ORD-9001", customer, "Nimal Perera", "Somewhere", "0771234567", "Airport", vehicle,
                LocalDate.now());
    }

    private Bill sampleBill() {
        return new Bill(sampleBooking(), new BigDecimal("100.00"), new BigDecimal("10.00"), new BigDecimal("5.00"),
                new BigDecimal("105.00"), LocalDate.now());
    }

    @Test
    void showFormRendersBillFormView() throws Exception {
        when(bookingService.getBooking(eq(1L))).thenReturn(sampleBooking());

        mockMvc.perform(get("/bookings/1/bill/new"))
                .andExpect(status().isOk())
                .andExpect(view().name("bill-form"));
    }

    @Test
    void submitWithValidDataRedirectsToBillView() throws Exception {
        when(bookingService.getBooking(eq(1L))).thenReturn(sampleBooking());
        when(billService.generateBill(eq(1L), any(BillRequest.class))).thenReturn(sampleBill());

        mockMvc.perform(post("/bookings/1/bill").param("discountAmount", "5.00"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/bookings/1/bill"));
    }

    @Test
    void submitWhenAlreadyBilledRedisplaysFormWithError() throws Exception {
        when(bookingService.getBooking(eq(1L))).thenReturn(sampleBooking());
        when(billService.generateBill(eq(1L), any(BillRequest.class)))
                .thenThrow(new DuplicateResourceException("Booking 'ORD-9001' has already been billed"));

        mockMvc.perform(post("/bookings/1/bill").param("discountAmount", "0"))
                .andExpect(status().isOk())
                .andExpect(view().name("bill-form"))
                .andExpect(model().attribute("errorMessage", "Booking 'ORD-9001' has already been billed"));
    }

    @Test
    void viewRendersBillViewWithBillAndBooking() throws Exception {
        when(bookingService.getBooking(eq(1L))).thenReturn(sampleBooking());
        when(billService.getBillForBooking(eq(1L))).thenReturn(sampleBill());

        mockMvc.perform(get("/bookings/1/bill"))
                .andExpect(status().isOk())
                .andExpect(view().name("bill-view"));
    }
}
