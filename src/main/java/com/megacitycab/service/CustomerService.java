package com.megacitycab.service;

import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.megacitycab.dto.CustomerRegistrationRequest;
import com.megacitycab.exception.DuplicateRegistrationException;
import com.megacitycab.model.Customer;
import com.megacitycab.model.Role;
import com.megacitycab.model.User;
import com.megacitycab.repository.CustomerRepository;
import com.megacitycab.repository.UserRepository;

@Service
public class CustomerService {

    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final PasswordEncoder passwordEncoder;

    public CustomerService(UserRepository userRepository, CustomerRepository customerRepository,
                            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.customerRepository = customerRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public Customer register(CustomerRegistrationRequest request) {
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new DuplicateRegistrationException("Username '" + request.getUsername() + "' is already taken");
        }
        if (customerRepository.findByNic(request.getNic()).isPresent()) {
            throw new DuplicateRegistrationException("A customer with NIC '" + request.getNic() + "' is already registered");
        }

        User user = userRepository.save(
                new User(request.getUsername(), passwordEncoder.encode(request.getPassword()), Role.CUSTOMER));

        Customer customer = new Customer(generateRegistrationNo(), request.getName(), request.getAddress(),
                request.getNic());
        customer.setUser(user);
        return customerRepository.save(customer);
    }

    private String generateRegistrationNo() {
        return "REG-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }
}
