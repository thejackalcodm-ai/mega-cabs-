package com.megacitycab.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.megacitycab.dto.BillRequest;
import com.megacitycab.exception.DuplicateResourceException;
import com.megacitycab.exception.InvalidBookingException;
import com.megacitycab.exception.ResourceNotFoundException;
import com.megacitycab.model.Bill;
import com.megacitycab.model.Booking;
import com.megacitycab.model.Customer;
import com.megacitycab.model.Vehicle;
import com.megacitycab.model.VehicleType;
import com.megacitycab.repository.BillRepository;

class BillServiceTest {

    private BillRepository billRepository;
    private BookingService bookingService;
    private BillService billService;

    @BeforeEach
    void setUp() {
        billRepository = mock(BillRepository.class);
        bookingService = mock(BookingService.class);
        billService = new BillService(billRepository, bookingService);
    }

    private Booking sampleBooking(BigDecimal dailyRate) {
        Customer customer = new Customer("REG-1", "Nimal Perera", "Somewhere", "901234567V");
        Vehicle vehicle = new Vehicle("CAB-1", "Toyota", "Prius", VehicleType.CAR, 4, dailyRate);
        return new Booking("ORD-1", customer, "Nimal Perera", "Somewhere", "0771234567", "Airport", vehicle,
                LocalDate.now());
    }

    private BillRequest requestWithDiscount(String discount) {
        BillRequest request = new BillRequest();
        request.setDiscountAmount(new BigDecimal(discount));
        return request;
    }

    @Test
    void generateBillCalculatesTaxAndTotalCorrectly() {
        Booking booking = sampleBooking(new BigDecimal("100.00"));
        when(bookingService.getBooking(1L)).thenReturn(booking);
        when(billRepository.findByBooking(booking)).thenReturn(Optional.empty());
        when(billRepository.save(any(Bill.class))).thenAnswer(i -> i.getArgument(0));

        Bill bill = billService.generateBill(1L, requestWithDiscount("10.00"));

        assertThat(bill.getSubtotal()).isEqualByComparingTo("100.00");
        assertThat(bill.getTaxAmount()).isEqualByComparingTo("10.00");
        assertThat(bill.getDiscountAmount()).isEqualByComparingTo("10.00");
        assertThat(bill.getTotalAmount()).isEqualByComparingTo("100.00");
    }

    @Test
    void generateBillRejectsWhenAlreadyBilled() {
        Booking booking = sampleBooking(new BigDecimal("100.00"));
        when(bookingService.getBooking(1L)).thenReturn(booking);
        when(billRepository.findByBooking(booking)).thenReturn(Optional.of(mock(Bill.class)));

        assertThatThrownBy(() -> billService.generateBill(1L, requestWithDiscount("0")))
                .isInstanceOf(DuplicateResourceException.class);
    }

    @Test
    void generateBillRejectsDiscountLargerThanTotal() {
        Booking booking = sampleBooking(new BigDecimal("50.00"));
        when(bookingService.getBooking(1L)).thenReturn(booking);
        when(billRepository.findByBooking(booking)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> billService.generateBill(1L, requestWithDiscount("999.00")))
                .isInstanceOf(InvalidBookingException.class);
    }

    @Test
    void getBillForBookingThrowsWhenNotBilled() {
        Booking booking = sampleBooking(new BigDecimal("100.00"));
        when(bookingService.getBooking(1L)).thenReturn(booking);
        when(billRepository.findByBooking(booking)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> billService.getBillForBooking(1L))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
