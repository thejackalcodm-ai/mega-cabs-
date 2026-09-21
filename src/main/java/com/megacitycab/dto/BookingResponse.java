package com.megacitycab.dto;

import java.time.LocalDate;

import com.megacitycab.model.Booking;
import com.megacitycab.model.BookingStatus;

public class BookingResponse {

    private final Long id;
    private final String orderNo;
    private final String customerRegistrationNo;
    private final String name;
    private final String address;
    private final String phone;
    private final String destination;
    private final String vehicleRegistrationNo;
    private final LocalDate bookingDate;
    private final BookingStatus status;

    public BookingResponse(Booking booking) {
        this.id = booking.getId();
        this.orderNo = booking.getOrderNo();
        this.customerRegistrationNo = booking.getCustomer().getRegistrationNo();
        this.name = booking.getName();
        this.address = booking.getAddress();
        this.phone = booking.getPhone();
        this.destination = booking.getDestination();
        this.vehicleRegistrationNo = booking.getVehicle().getRegistrationNo();
        this.bookingDate = booking.getBookingDate();
        this.status = booking.getStatus();
    }

    public Long getId() {
        return id;
    }

    public String getOrderNo() {
        return orderNo;
    }

    public String getCustomerRegistrationNo() {
        return customerRegistrationNo;
    }

    public String getName() {
        return name;
    }

    public String getAddress() {
        return address;
    }

    public String getPhone() {
        return phone;
    }

    public String getDestination() {
        return destination;
    }

    public String getVehicleRegistrationNo() {
        return vehicleRegistrationNo;
    }

    public LocalDate getBookingDate() {
        return bookingDate;
    }

    public BookingStatus getStatus() {
        return status;
    }
}
