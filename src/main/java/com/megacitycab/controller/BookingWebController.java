package com.megacitycab.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import com.megacitycab.dto.BookingRequest;
import com.megacitycab.exception.InvalidBookingException;
import com.megacitycab.exception.ResourceNotFoundException;
import com.megacitycab.model.Booking;
import com.megacitycab.service.BillService;
import com.megacitycab.service.BookingService;

import jakarta.validation.Valid;

@Controller
public class BookingWebController {

    private final BookingService bookingService;
    private final BillService billService;

    public BookingWebController(BookingService bookingService, BillService billService) {
        this.bookingService = bookingService;
        this.billService = billService;
    }

    @GetMapping("/book")
    public String showForm(Model model) {
        if (!model.containsAttribute("bookingRequest")) {
            model.addAttribute("bookingRequest", new BookingRequest());
        }
        model.addAttribute("availableVehicles", bookingService.listAvailableVehicles());
        return "booking-form";
    }

    @PostMapping("/book")
    public String submit(@Valid @ModelAttribute BookingRequest bookingRequest, BindingResult bindingResult,
                          Model model, RedirectAttributes redirectAttributes) {
        if (bindingResult.hasErrors()) {
            model.addAttribute("availableVehicles", bookingService.listAvailableVehicles());
            return "booking-form";
        }

        try {
            Booking booking = bookingService.createBooking(bookingRequest);
            return "redirect:/bookings/" + booking.getId();
        } catch (ResourceNotFoundException | InvalidBookingException ex) {
            model.addAttribute("errorMessage", ex.getMessage());
            model.addAttribute("availableVehicles", bookingService.listAvailableVehicles());
            return "booking-form";
        }
    }

    @GetMapping("/bookings")
    public String list(Model model) {
        model.addAttribute("bookings", bookingService.listBookings());
        return "bookings";
    }

    @GetMapping("/bookings/{id}")
    public String detail(@PathVariable Long id, Model model) {
        Booking booking = bookingService.getBooking(id);
        model.addAttribute("booking", booking);
        model.addAttribute("hasBill", billService.hasBill(id));
        return "booking-detail";
    }
}
