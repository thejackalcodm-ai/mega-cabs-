package com.megacitycab.service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.megacitycab.dto.BookingRequest;
import com.megacitycab.exception.InvalidBookingException;
import com.megacitycab.exception.ResourceNotFoundException;
import com.megacitycab.model.Booking;
import com.megacitycab.model.Customer;
import com.megacitycab.model.Vehicle;
import com.megacitycab.model.VehicleStatus;
import com.megacitycab.repository.BookingRepository;
import com.megacitycab.repository.CustomerRepository;
import com.megacitycab.repository.VehicleRepository;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;
    private final CustomerRepository customerRepository;
    private final VehicleRepository vehicleRepository;

    public BookingService(BookingRepository bookingRepository, CustomerRepository customerRepository,
                           VehicleRepository vehicleRepository) {
        this.bookingRepository = bookingRepository;
        this.customerRepository = customerRepository;
        this.vehicleRepository = vehicleRepository;
    }

    @Transactional
    public Booking createBooking(BookingRequest request) {
        Customer customer = customerRepository.findByRegistrationNo(request.getCustomerRegistrationNo())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No customer found with registration number '" + request.getCustomerRegistrationNo() + "'"));

        Vehicle vehicle = vehicleRepository.findById(request.getVehicleId())
                .orElseThrow(() -> new ResourceNotFoundException("No vehicle found with id " + request.getVehicleId()));

        if (vehicle.getStatus() != VehicleStatus.AVAILABLE) {
            throw new InvalidBookingException(
                    "Vehicle '" + vehicle.getRegistrationNo() + "' is not available for booking");
        }

        Booking booking = new Booking(generateOrderNo(), customer, request.getName(), request.getAddress(),
                request.getPhone(), request.getDestination(), vehicle, LocalDate.now());

        vehicle.setStatus(VehicleStatus.BOOKED);
        vehicleRepository.save(vehicle);

        return bookingRepository.save(booking);
    }

    public List<Booking> listBookings() {
        return bookingRepository.findAll();
    }

    public Booking getBooking(Long id) {
        return bookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("No booking found with id " + id));
    }

    public List<Vehicle> listAvailableVehicles() {
        return vehicleRepository.findByStatus(VehicleStatus.AVAILABLE);
    }

    private String generateOrderNo() {
        return "ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
