package com.megacitycab.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.megacitycab.model.Booking;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    Optional<Booking> findByOrderNo(String orderNo);
}
