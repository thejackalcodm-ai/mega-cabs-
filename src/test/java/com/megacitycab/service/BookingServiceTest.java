package com.megacitycab.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.megacitycab.dto.BookingRequest;
import com.megacitycab.exception.InvalidBookingException;
import com.megacitycab.exception.ResourceNotFoundException;
import com.megacitycab.model.Booking;
import com.megacitycab.model.Customer;
import com.megacitycab.model.Vehicle;
import com.megacitycab.model.VehicleStatus;
import com.megacitycab.model.VehicleType;
import com.megacitycab.repository.BookingRepository;
import com.megacitycab.repository.CustomerRepository;
import com.megacitycab.repository.VehicleRepository;

class BookingServiceTest {

    private BookingRepository bookingRepository;
    private CustomerRepository customerRepository;
    private VehicleRepository vehicleRepository;
    private BookingService bookingService;

    @BeforeEach
    void setUp() {
        bookingRepository = mock(BookingRepository.class);
        customerRepository = mock(CustomerRepository.class);
        vehicleRepository = mock(VehicleRepository.class);
        bookingService = new BookingService(bookingRepository, customerRepository, vehicleRepository);
    }

    private BookingRequest validRequest() {
        BookingRequest request = new BookingRequest();
        request.setCustomerRegistrationNo("REG-1234ABCD");
        request.setName("Nimal Perera");
        request.setAddress("12 Galle Road, Colombo");
        request.setPhone("0771234567");
        request.setDestination("Airport");
        request.setVehicleId(1L);
        return request;
    }

    @Test
    void createBookingSucceedsAndMarksVehicleBooked() {
        Customer customer = new Customer("REG-1234ABCD", "Nimal Perera", "Somewhere", "901234567V");
        Vehicle vehicle = new Vehicle("CAB-1", "Toyota", "Prius", VehicleType.CAR, 4, new BigDecimal("35.00"));
        when(customerRepository.findByRegistrationNo("REG-1234ABCD")).thenReturn(Optional.of(customer));
        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(vehicle));
        when(vehicleRepository.save(any(Vehicle.class))).thenAnswer(i -> i.getArgument(0));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(i -> i.getArgument(0));

        Booking booking = bookingService.createBooking(validRequest());

        assertThat(booking.getOrderNo()).startsWith("ORD-");
        assertThat(booking.getCustomer()).isEqualTo(customer);
        assertThat(booking.getVehicle()).isEqualTo(vehicle);
        assertThat(vehicle.getStatus()).isEqualTo(VehicleStatus.BOOKED);
        verify(vehicleRepository).save(vehicle);
    }

    @Test
    void createBookingRejectsUnknownCustomer() {
        when(customerRepository.findByRegistrationNo("REG-1234ABCD")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> bookingService.createBooking(validRequest()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void createBookingRejectsUnknownVehicle() {
        Customer customer = new Customer("REG-1234ABCD", "Nimal Perera", "Somewhere", "901234567V");
        when(customerRepository.findByRegistrationNo("REG-1234ABCD")).thenReturn(Optional.of(customer));
        when(vehicleRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> bookingService.createBooking(validRequest()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void createBookingRejectsUnavailableVehicle() {
        Customer customer = new Customer("REG-1234ABCD", "Nimal Perera", "Somewhere", "901234567V");
        Vehicle vehicle = new Vehicle("CAB-1", "Toyota", "Prius", VehicleType.CAR, 4, new BigDecimal("35.00"));
        vehicle.setStatus(VehicleStatus.BOOKED);
        when(customerRepository.findByRegistrationNo("REG-1234ABCD")).thenReturn(Optional.of(customer));
        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(vehicle));

        assertThatThrownBy(() -> bookingService.createBooking(validRequest()))
                .isInstanceOf(InvalidBookingException.class);
    }
}
