package com.megacitycab.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import com.megacitycab.dto.CustomerRegistrationRequest;
import com.megacitycab.exception.DuplicateRegistrationException;
import com.megacitycab.model.Customer;
import com.megacitycab.service.CustomerService;

import jakarta.validation.Valid;

@Controller
public class RegistrationController {

    private final CustomerService customerService;

    public RegistrationController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping("/register")
    public String showForm(Model model) {
        if (!model.containsAttribute("customerRegistrationRequest")) {
            model.addAttribute("customerRegistrationRequest", new CustomerRegistrationRequest());
        }
        return "register";
    }

    @PostMapping("/register")
    public String submit(@Valid @ModelAttribute CustomerRegistrationRequest customerRegistrationRequest,
                          BindingResult bindingResult, Model model, RedirectAttributes redirectAttributes) {
        if (bindingResult.hasErrors()) {
            return "register";
        }

        try {
            Customer customer = customerService.register(customerRegistrationRequest);
            redirectAttributes.addFlashAttribute("registrationNo", customer.getRegistrationNo());
            redirectAttributes.addFlashAttribute("name", customer.getName());
            return "redirect:/register/success";
        } catch (DuplicateRegistrationException ex) {
            model.addAttribute("errorMessage", ex.getMessage());
            return "register";
        }
    }

    @GetMapping("/register/success")
    public String success(Model model) {
        if (!model.containsAttribute("registrationNo")) {
            return "redirect:/register";
        }
        return "registration-success";
    }
}
