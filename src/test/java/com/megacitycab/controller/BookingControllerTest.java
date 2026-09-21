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
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.megacitycab.dto.BookingRequest;
import com.megacitycab.exception.InvalidBookingException;
import com.megacitycab.exception.ResourceNotFoundException;
import com.megacitycab.model.Booking;
import com.megacitycab.model.Customer;
import com.megacitycab.model.Vehicle;
import com.megacitycab.model.VehicleType;
import com.megacitycab.service.BookingService;

@WebMvcTest(BookingController.class)
class BookingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private BookingService bookingService;

    private static final String VALID_BODY = "{"
            + "\"customerRegistrationNo\":\"REG-1234ABCD\","
            + "\"name\":\"Nimal Perera\","
            + "\"address\":\"12 Galle Road\","
            + "\"phone\":\"0771234567\","
            + "\"destination\":\"Airport\","
            + "\"vehicleId\":1}";

    private Booking sampleBooking() {
        Customer customer = new Customer("REG-1234ABCD", "Nimal Perera", "Somewhere", "901234567V");
        Vehicle vehicle = new Vehicle("CAB-1", "Toyota", "Prius", VehicleType.CAR, 4, new BigDecimal("35.00"));
        return new Booking("ORD-9001", customer, "Nimal Perera", "12 Galle Road", "0771234567", "Airport", vehicle,
                LocalDate.now());
    }

    @Test
    void createBookingWithValidDataReturns201() throws Exception {
        when(bookingService.createBooking(any(BookingRequest.class))).thenReturn(sampleBooking());

        mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.orderNo").value("ORD-9001"))
                .andExpect(jsonPath("$.customerRegistrationNo").value("REG-1234ABCD"));
    }

    @Test
    void createBookingWithUnknownCustomerReturns404() throws Exception {
        when(bookingService.createBooking(any(BookingRequest.class)))
                .thenThrow(new ResourceNotFoundException("No customer found with registration number 'REG-1234ABCD'"));

        mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isNotFound());
    }

    @Test
    void createBookingWithUnavailableVehicleReturns409() throws Exception {
        when(bookingService.createBooking(any(BookingRequest.class)))
                .thenThrow(new InvalidBookingException("Vehicle 'CAB-1' is not available for booking"));

        mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isConflict());
    }

    @Test
    void createBookingWithBlankFieldsReturns400() throws Exception {
        mockMvc.perform(post("/api/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listBookingsReturnsAll() throws Exception {
        when(bookingService.listBookings()).thenReturn(List.of(sampleBooking()));

        mockMvc.perform(get("/api/bookings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].orderNo").value("ORD-9001"));
    }

    @Test
    void getBookingReturns404WhenMissing() throws Exception {
        when(bookingService.getBooking(eq(99L))).thenThrow(new ResourceNotFoundException("No booking found with id 99"));

        mockMvc.perform(get("/api/bookings/99"))
                .andExpect(status().isNotFound());
    }
}
