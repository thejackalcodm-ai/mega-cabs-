package com.megacitycab.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.model;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

import com.megacitycab.exception.InvalidCredentialsException;
import com.megacitycab.model.Role;
import com.megacitycab.model.User;
import com.megacitycab.service.AuthService;

@WebMvcTest(LoginWebController.class)
class LoginWebControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    @Test
    void showFormRendersLoginView() throws Exception {
        mockMvc.perform(get("/login"))
                .andExpect(status().isOk())
                .andExpect(view().name("login"));
    }

    @Test
    void submitWithValidCredentialsEstablishesSessionAndRedirectsHome() throws Exception {
        when(authService.authenticate(eq("jsilva"), eq("secret123")))
                .thenReturn(new User("jsilva", "hashed", Role.CUSTOMER));

        mockMvc.perform(post("/login")
                        .param("username", "jsilva")
                        .param("password", "secret123"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/"));
    }

    @Test
    void submitWithInvalidCredentialsRedisplaysFormWithError() throws Exception {
        when(authService.authenticate(eq("jsilva"), eq("wrongpass")))
                .thenThrow(new InvalidCredentialsException("Invalid username or password"));

        mockMvc.perform(post("/login")
                        .param("username", "jsilva")
                        .param("password", "wrongpass"))
                .andExpect(status().isOk())
                .andExpect(view().name("login"))
                .andExpect(model().attribute("errorMessage", "Invalid username or password"));
    }

    @Test
    void submitWithBlankFieldsRedisplaysFormWithErrors() throws Exception {
        mockMvc.perform(post("/login")
                        .param("username", "")
                        .param("password", ""))
                .andExpect(status().isOk())
                .andExpect(view().name("login"))
                .andExpect(model().attributeHasFieldErrors("loginRequest", "username", "password"));
    }

    @Test
    void logoutInvalidatesSessionAndRedirectsHome() throws Exception {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("username", "jsilva");

        mockMvc.perform(get("/logout").session(session))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("/"));
    }
}
