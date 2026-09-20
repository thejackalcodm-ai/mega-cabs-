package com.megacitycab.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Landing page controller.
 *
 * Serves as the initial smoke-test endpoint for Milestone 1 (project
 * foundation): confirms the Spring Boot application context starts and the
 * presentation layer renders correctly before any domain functionality is
 * added.
 */
@Controller
public class HomeController {

    @GetMapping("/")
    public String home() {
        return "index";
    }
}
