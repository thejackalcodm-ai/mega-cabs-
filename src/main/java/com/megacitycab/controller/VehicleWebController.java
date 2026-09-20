package com.megacitycab.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import com.megacitycab.dto.VehicleRequest;
import com.megacitycab.exception.DuplicateResourceException;
import com.megacitycab.model.VehicleType;
import com.megacitycab.service.VehicleService;

import jakarta.validation.Valid;

@Controller
public class VehicleWebController {

    private final VehicleService vehicleService;

    public VehicleWebController(VehicleService vehicleService) {
        this.vehicleService = vehicleService;
    }

    @GetMapping("/vehicles")
    public String list(Model model) {
        model.addAttribute("vehicles", vehicleService.listVehicles());
        return "vehicles";
    }

    @GetMapping("/vehicles/new")
    public String showForm(Model model) {
        if (!model.containsAttribute("vehicleRequest")) {
            model.addAttribute("vehicleRequest", new VehicleRequest());
        }
        model.addAttribute("vehicleTypes", VehicleType.values());
        return "vehicle-form";
    }

    @PostMapping("/vehicles")
    public String submit(@Valid @ModelAttribute VehicleRequest vehicleRequest, BindingResult bindingResult,
                          Model model, RedirectAttributes redirectAttributes) {
        if (bindingResult.hasErrors()) {
            model.addAttribute("vehicleTypes", VehicleType.values());
            return "vehicle-form";
        }

        try {
            vehicleService.addVehicle(vehicleRequest);
            redirectAttributes.addFlashAttribute("successMessage",
                    "Vehicle " + vehicleRequest.getRegistrationNo() + " added.");
            return "redirect:/vehicles";
        } catch (DuplicateResourceException ex) {
            model.addAttribute("errorMessage", ex.getMessage());
            model.addAttribute("vehicleTypes", VehicleType.values());
            return "vehicle-form";
        }
    }
}
