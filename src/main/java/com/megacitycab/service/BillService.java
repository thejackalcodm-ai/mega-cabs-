package com.megacitycab.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.megacitycab.dto.BillRequest;
import com.megacitycab.exception.DuplicateResourceException;
import com.megacitycab.exception.InvalidBookingException;
import com.megacitycab.exception.ResourceNotFoundException;
import com.megacitycab.model.Bill;
import com.megacitycab.model.Booking;
import com.megacitycab.repository.BillRepository;

@Service
public class BillService {

    /** Flat tax rate applied to every booking's subtotal (documented assumption - see report). */
    static final BigDecimal TAX_RATE = new BigDecimal("0.10");

    private final BillRepository billRepository;
    private final BookingService bookingService;

    public BillService(BillRepository billRepository, BookingService bookingService) {
        this.billRepository = billRepository;
        this.bookingService = bookingService;
    }

    @Transactional
    public Bill generateBill(Long bookingId, BillRequest request) {
        Booking booking = bookingService.getBooking(bookingId);

        if (billRepository.findByBooking(booking).isPresent()) {
            throw new DuplicateResourceException("Booking '" + booking.getOrderNo() + "' has already been billed");
        }

        BigDecimal subtotal = booking.getVehicle().getDailyRate();
        BigDecimal taxAmount = subtotal.multiply(TAX_RATE).setScale(2, RoundingMode.HALF_UP);
        BigDecimal discountAmount = request.getDiscountAmount().setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalAmount = subtotal.add(taxAmount).subtract(discountAmount);

        if (totalAmount.compareTo(BigDecimal.ZERO) < 0) {
            throw new InvalidBookingException("Discount cannot exceed the subtotal plus tax");
        }

        Bill bill = new Bill(booking, subtotal, taxAmount, discountAmount, totalAmount, LocalDate.now());
        return billRepository.save(bill);
    }

    public Bill getBillForBooking(Long bookingId) {
        Booking booking = bookingService.getBooking(bookingId);
        return billRepository.findByBooking(booking)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Booking '" + booking.getOrderNo() + "' has not been billed yet"));
    }

    public boolean hasBill(Long bookingId) {
        Booking booking = bookingService.getBooking(bookingId);
        return billRepository.findByBooking(booking).isPresent();
    }
}
