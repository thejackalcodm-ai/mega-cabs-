package com.megacitycab.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.megacitycab.dto.BookingRequest;
import com.megacitycab.dto.BookingResponse;
import com.megacitycab.service.BookingService;

import jakarta.validation.Valid;

@RestController
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping("/api/bookings")
    @ResponseStatus(HttpStatus.CREATED)
    public BookingResponse createBooking(@Valid @RequestBody BookingRequest request) {
        return new BookingResponse(bookingService.createBooking(request));
    }

    @GetMapping("/api/bookings")
    public List<BookingResponse> listBookings() {
        return bookingService.listBookings().stream().map(BookingResponse::new).toList();
    }

    @GetMapping("/api/bookings/{id}")
    public BookingResponse getBooking(@PathVariable Long id) {
        return new BookingResponse(bookingService.getBooking(id));
    }
}
