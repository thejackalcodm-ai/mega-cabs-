package com.megacitycab.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.model;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import com.megacitycab.dto.BookingRequest;
import com.megacitycab.exception.InvalidBookingException;
import com.megacitycab.model.Booking;
import com.megacitycab.model.Customer;
import com.megacitycab.model.Vehicle;
import com.megacitycab.model.VehicleType;
import com.megacitycab.service.BillService;
import com.megacitycab.service.BookingService;

@WebMvcTest(BookingWebController.class)
class BookingWebControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private BookingService bookingService;

    @MockBean
    private BillService billService;

    private Booking sampleBooking() {
        Customer customer = new Customer("REG-1", "Nimal Perera", "Somewhere", "901234567V");
        Vehicle vehicle = new Vehicle("CAB-1", "Toyota", "Prius", VehicleType.CAR, 4, new BigDecimal("35.00"));
        return new Booking("ORD-9001", customer, "Nimal Perera", "12 Galle Road", "0771234567", "Airport", vehicle,
                LocalDate.now());
    }

    @Test
    void showFormRendersBookingFormView() throws Exception {
        when(bookingService.listAvailableVehicles()).thenReturn(List.of());

        mockMvc.perform(get("/book"))
                .andExpect(status().isOk())
                .andExpect(view().name("booking-form"));
    }

    @Test
    void submitWithValidDataRedirectsToBookingDetail() throws Exception {
        Booking booking = mock(Booking.class);
        when(booking.getId()).thenReturn(42L);
        when(bookingService.createBooking(any(BookingRequest.class))).thenReturn(booking);

        mockMvc.perform(post("/book")
                        .param("customerRegistrationNo", "REG-1")
                        .param("name", "Nimal Perera")
                        .param("address", "12 Galle Road")
                        .param("phone", "0771234567")
                        .param("destination", "Airport")
                        .param("vehicleId", "1"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/bookings/42"));
    }

    @Test
    void submitWithBlankFieldsRedisplaysFormWithErrors() throws Exception {
        when(bookingService.listAvailableVehicles()).thenReturn(List.of());

        mockMvc.perform(post("/book")
                        .param("customerRegistrationNo", "")
                        .param("name", "")
                        .param("address", "")
                        .param("phone", "")
                        .param("destination", ""))
                .andExpect(status().isOk())
                .andExpect(view().name("booking-form"))
                .andExpect(model().attributeHasFieldErrors("bookingRequest", "customerRegistrationNo", "name"));
    }

    @Test
    void submitWithUnavailableVehicleRedisplaysFormWithError() throws Exception {
        when(bookingService.createBooking(any(BookingRequest.class)))
                .thenThrow(new InvalidBookingException("Vehicle 'CAB-1' is not available for booking"));
        when(bookingService.listAvailableVehicles()).thenReturn(List.of());

        mockMvc.perform(post("/book")
                        .param("customerRegistrationNo", "REG-1")
                        .param("name", "Nimal Perera")
                        .param("address", "12 Galle Road")
                        .param("phone", "0771234567")
                        .param("destination", "Airport")
                        .param("vehicleId", "1"))
                .andExpect(status().isOk())
                .andExpect(view().name("booking-form"))
                .andExpect(model().attribute("errorMessage", "Vehicle 'CAB-1' is not available for booking"));
    }

    @Test
    void listRendersBookingsView() throws Exception {
        when(bookingService.listBookings()).thenReturn(List.of(sampleBooking()));

        mockMvc.perform(get("/bookings"))
                .andExpect(status().isOk())
                .andExpect(view().name("bookings"));
    }

    @Test
    void detailRendersBookingDetailView() throws Exception {
        when(bookingService.getBooking(eq(1L))).thenReturn(sampleBooking());
        when(billService.hasBill(eq(1L))).thenReturn(false);

        mockMvc.perform(get("/bookings/1"))
                .andExpect(status().isOk())
                .andExpect(view().name("booking-detail"))
                .andExpect(model().attribute("hasBill", false));
    }
}
