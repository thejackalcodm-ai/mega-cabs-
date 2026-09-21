package com.megacitycab.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;

import com.megacitycab.dto.LoginRequest;
import com.megacitycab.exception.InvalidCredentialsException;
import com.megacitycab.model.User;
import com.megacitycab.service.AuthService;

import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;

@Controller
public class LoginWebController {

    private final AuthService authService;

    public LoginWebController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/login")
    public String showForm(Model model) {
        if (!model.containsAttribute("loginRequest")) {
            model.addAttribute("loginRequest", new LoginRequest());
        }
        return "login";
    }

    @PostMapping("/login")
    public String login(@Valid @ModelAttribute("loginRequest") LoginRequest loginRequest, BindingResult bindingResult,
                         Model model, HttpSession session) {
        if (bindingResult.hasErrors()) {
            return "login";
        }

        try {
            User user = authService.authenticate(loginRequest.getUsername(), loginRequest.getPassword());
            session.setAttribute("username", user.getUsername());
            session.setAttribute("role", user.getRole().name());
            return "redirect:/";
        } catch (InvalidCredentialsException ex) {
            model.addAttribute("errorMessage", ex.getMessage());
            return "login";
        }
    }

    @GetMapping("/logout")
    public String logout(HttpSession session) {
        session.invalidate();
        return "redirect:/";
    }
}
