package com.megacitycab.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.megacitycab.model.Bill;
import com.megacitycab.model.Booking;

public interface BillRepository extends JpaRepository<Bill, Long> {

    Optional<Bill> findByBooking(Booking booking);
}
