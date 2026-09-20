package com.megacitycab.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.megacitycab.model.Customer;

public interface CustomerRepository extends JpaRepository<Customer, Long> {

    Optional<Customer> findByRegistrationNo(String registrationNo);

    Optional<Customer> findByNic(String nic);
}
