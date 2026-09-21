package com.megacitycab.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import com.megacitycab.dto.DriverRequest;
import com.megacitycab.exception.DuplicateResourceException;
import com.megacitycab.service.DriverService;

import jakarta.validation.Valid;

@Controller
public class DriverWebController {

    private final DriverService driverService;

    public DriverWebController(DriverService driverService) {
        this.driverService = driverService;
    }

    @GetMapping("/drivers")
    public String list(Model model) {
        model.addAttribute("drivers", driverService.listDrivers());
        return "drivers";
    }

    @GetMapping("/drivers/new")
    public String showForm(Model model) {
        if (!model.containsAttribute("driverRequest")) {
            model.addAttribute("driverRequest", new DriverRequest());
        }
        return "driver-form";
    }

    @PostMapping("/drivers")
    public String submit(@Valid @ModelAttribute DriverRequest driverRequest, BindingResult bindingResult,
                          Model model, RedirectAttributes redirectAttributes) {
        if (bindingResult.hasErrors()) {
            return "driver-form";
        }

        try {
            driverService.addDriver(driverRequest);
            redirectAttributes.addFlashAttribute("successMessage", "Driver " + driverRequest.getName() + " added.");
            return "redirect:/drivers";
        } catch (DuplicateResourceException ex) {
            model.addAttribute("errorMessage", ex.getMessage());
            return "driver-form";
        }
    }
}
