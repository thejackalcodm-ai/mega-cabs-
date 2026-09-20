package com.megacitycab.repository;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import com.megacitycab.model.Bill;
import com.megacitycab.model.Booking;
import com.megacitycab.model.Customer;
import com.megacitycab.model.Driver;
import com.megacitycab.model.Role;
import com.megacitycab.model.User;
import com.megacitycab.model.Vehicle;
import com.megacitycab.model.VehicleStatus;
import com.megacitycab.model.VehicleType;

/**
 * Milestone 2: proves the JPA entity model actually persists to, and
 * round-trips from, a real relational database (H2) - not just that the
 * classes compile. Every relationship in the domain (User-Customer,
 * Customer/Vehicle/Driver-Booking, Booking-Bill) is exercised.
 */
@DataJpaTest
class RepositoryPersistenceTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private VehicleRepository vehicleRepository;

    @Autowired
    private DriverRepository driverRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private BillRepository billRepository;

    @Test
    void customerRegistrationPersistsAndLinksToUser() {
        User user = userRepository.save(new User("jsilva", "hashed-password", Role.CUSTOMER));
        Customer customer = new Customer("REG-1001", "J. Silva", "12 Galle Road, Colombo", "982761234V");
        customer.setUser(user);
        customer = customerRepository.save(customer);

        Optional<Customer> found = customerRepository.findByRegistrationNo("REG-1001");
        assertTrue(found.isPresent());
        assertEquals("J. Silva", found.get().getName());
        assertEquals("982761234V", found.get().getNic());
        assertNotNull(found.get().getUser());
        assertEquals("jsilva", found.get().getUser().getUsername());
    }

    @Test
    void vehicleAndDriverManagementPersistIndependently() {
        Vehicle vehicle = vehicleRepository.save(
                new Vehicle("CAB-2233", "Toyota", "Prius", VehicleType.CAR, 4, new BigDecimal("35.00")));
        Driver driver = driverRepository.save(new Driver("K. Perera", "B1234567", "0771234567"));

        assertEquals(VehicleStatus.AVAILABLE, vehicleRepository.findById(vehicle.getId()).orElseThrow().getStatus());
        assertEquals("K. Perera", driverRepository.findByLicenseNo("B1234567").orElseThrow().getName());
    }

    @Test
    void bookingLinksCustomerVehicleAndDriver() {
        Customer customer = customerRepository.save(
                new Customer("REG-1002", "N. Fernando", "45 Kandy Road, Kandy", "912345678V"));
        Vehicle vehicle = vehicleRepository.save(
                new Vehicle("CAB-4477", "Nissan", "Caravan", VehicleType.VAN, 8, new BigDecimal("55.00")));
        Driver driver = driverRepository.save(new Driver("S. Bandara", "B7654321", "0779876543"));

        Booking booking = new Booking("ORD-9001", customer, customer.getName(), customer.getAddress(),
                "0711112222", "Bandaranaike International Airport", vehicle, LocalDate.now());
        booking.setDriver(driver);
        booking = bookingRepository.save(booking);

        Booking found = bookingRepository.findByOrderNo("ORD-9001").orElseThrow();
        assertEquals(customer.getId(), found.getCustomer().getId());
        assertEquals(vehicle.getId(), found.getVehicle().getId());
        assertEquals(driver.getId(), found.getDriver().getId());
        assertEquals("Bandaranaike International Airport", found.getDestination());
    }

    @Test
    void billCalculatesAndPersistsAgainstBooking() {
        Customer customer = customerRepository.save(
                new Customer("REG-1003", "A. Silva", "9 Marine Drive, Colombo", "902345671V"));
        Vehicle vehicle = vehicleRepository.save(
                new Vehicle("CAB-5588", "Toyota", "Corolla", VehicleType.CAR, 4, new BigDecimal("40.00")));
        Booking booking = bookingRepository.save(new Booking("ORD-9002", customer, customer.getName(),
                customer.getAddress(), "0713334444", "Galle Fort", vehicle, LocalDate.now()));

        BigDecimal subtotal = new BigDecimal("120.00");
        BigDecimal tax = subtotal.multiply(new BigDecimal("0.10"));
        BigDecimal discount = new BigDecimal("10.00");
        BigDecimal total = subtotal.add(tax).subtract(discount);

        billRepository.save(new Bill(booking, subtotal, tax, discount, total, LocalDate.now()));

        Bill found = billRepository.findByBooking(booking).orElseThrow();
        assertEquals(0, new BigDecimal("122.00").compareTo(found.getTotalAmount()));
    }
}
