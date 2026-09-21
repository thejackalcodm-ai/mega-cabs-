package com.megacitycab.controller;

import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ModelAttribute;

import jakarta.servlet.http.HttpServletRequest;

@ControllerAdvice
public class GlobalModelAttributes {

    @ModelAttribute("currentUsername")
    public String currentUsername(HttpServletRequest request) {
        var session = request.getSession(false);
        return session == null ? null : (String) session.getAttribute("username");
    }
}
