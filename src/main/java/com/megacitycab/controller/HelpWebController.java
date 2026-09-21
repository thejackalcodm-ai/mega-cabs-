package com.megacitycab.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class HelpWebController {

    @GetMapping("/help")
    public String help() {
        return "help";
    }
}
