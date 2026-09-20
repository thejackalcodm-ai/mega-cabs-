package com.megacitycab.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.megacitycab.dto.CustomerRegistrationRequest;
import com.megacitycab.exception.DuplicateRegistrationException;
import com.megacitycab.model.Customer;
import com.megacitycab.model.Role;
import com.megacitycab.model.User;
import com.megacitycab.repository.CustomerRepository;
import com.megacitycab.repository.UserRepository;

class CustomerServiceTest {

    private UserRepository userRepository;
    private CustomerRepository customerRepository;
    private PasswordEncoder passwordEncoder;
    private CustomerService customerService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        customerRepository = mock(CustomerRepository.class);
        passwordEncoder = new BCryptPasswordEncoder();
        customerService = new CustomerService(userRepository, customerRepository, passwordEncoder);
    }

    private CustomerRegistrationRequest validRequest() {
        CustomerRegistrationRequest request = new CustomerRegistrationRequest();
        request.setUsername("jsilva");
        request.setPassword("secret123");
        request.setName("J. Silva");
        request.setAddress("12 Galle Road, Colombo");
        request.setNic("982761234V");
        return request;
    }

    @Test
    void registerCreatesUserAndCustomerWithGeneratedRegistrationNo() {
        when(userRepository.findByUsername("jsilva")).thenReturn(Optional.empty());
        when(customerRepository.findByNic("982761234V")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(customerRepository.save(any(Customer.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Customer customer = customerService.register(validRequest());

        assertThat(customer.getName()).isEqualTo("J. Silva");
        assertThat(customer.getNic()).isEqualTo("982761234V");
        assertThat(customer.getRegistrationNo()).startsWith("REG-");
        assertThat(customer.getUser()).isNotNull();
        assertThat(customer.getUser().getUsername()).isEqualTo("jsilva");
        assertThat(customer.getUser().getRole()).isEqualTo(Role.CUSTOMER);
        assertThat(passwordEncoder.matches("secret123", customer.getUser().getPassword())).isTrue();
    }

    @Test
    void registerRejectsDuplicateUsername() {
        when(userRepository.findByUsername("jsilva"))
                .thenReturn(Optional.of(new User("jsilva", "hash", Role.CUSTOMER)));

        assertThatThrownBy(() -> customerService.register(validRequest()))
                .isInstanceOf(DuplicateRegistrationException.class);
    }

    @Test
    void registerRejectsDuplicateNic() {
        when(userRepository.findByUsername("jsilva")).thenReturn(Optional.empty());
        when(customerRepository.findByNic("982761234V"))
                .thenReturn(Optional.of(new Customer("REG-EXISTING", "Someone Else", "Somewhere", "982761234V")));

        assertThatThrownBy(() -> customerService.register(validRequest()))
                .isInstanceOf(DuplicateRegistrationException.class);
    }
}
