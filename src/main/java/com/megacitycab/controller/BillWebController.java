package com.megacitycab.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

import com.megacitycab.dto.BillRequest;
import com.megacitycab.exception.DuplicateResourceException;
import com.megacitycab.exception.InvalidBookingException;
import com.megacitycab.model.Booking;
import com.megacitycab.service.BillService;
import com.megacitycab.service.BookingService;

import jakarta.validation.Valid;

@Controller
public class BillWebController {

    private final BillService billService;
    private final BookingService bookingService;

    public BillWebController(BillService billService, BookingService bookingService) {
        this.billService = billService;
        this.bookingService = bookingService;
    }

    @GetMapping("/bookings/{id}/bill/new")
    public String showForm(@PathVariable Long id, Model model) {
        if (!model.containsAttribute("billRequest")) {
            model.addAttribute("billRequest", new BillRequest());
        }
        model.addAttribute("booking", bookingService.getBooking(id));
        return "bill-form";
    }

    @PostMapping("/bookings/{id}/bill")
    public String submit(@PathVariable Long id, @Valid @ModelAttribute BillRequest billRequest,
                          BindingResult bindingResult, Model model) {
        Booking booking = bookingService.getBooking(id);

        if (bindingResult.hasErrors()) {
            model.addAttribute("booking", booking);
            return "bill-form";
        }

        try {
            billService.generateBill(id, billRequest);
            return "redirect:/bookings/" + id + "/bill";
        } catch (DuplicateResourceException | InvalidBookingException ex) {
            model.addAttribute("errorMessage", ex.getMessage());
            model.addAttribute("booking", booking);
            return "bill-form";
        }
    }

    @GetMapping("/bookings/{id}/bill")
    public String view(@PathVariable Long id, Model model) {
        model.addAttribute("booking", bookingService.getBooking(id));
        model.addAttribute("bill", billService.getBillForBooking(id));
        return "bill-view";
    }
}
