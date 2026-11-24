package com.talaan.ledger.controller;

import com.talaan.ledger.model.User;
import com.talaan.ledger.service.AuthService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * TODO (security): this endpoint is meant to be admin-only, per the
     * project's current decision ("we'll secure it later"). Right now it
     * is NOT restricted — anyone who can reach this route can create a
     * user. Once a Spring Security filter chain / JWT layer exists, lock
     * this down with something like:
     *   @PreAuthorize("hasRole('ADMIN')")
     * or by requiring an authenticated admin session before this route is
     * reachable. Do not ship this open to the public internet as-is.
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        if (request.username() == null || request.username().isBlank()
                || request.password() == null || request.password().isBlank()
                || request.role() == null || request.role().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "username, password, and role are all required"));
        }

        try {
            User user = authService.register(request.username(), request.password(), request.role());
            String ledgerKey = authService.buildLedgerKey(user.getUsername());
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(Map.of("ledgerKey", ledgerKey));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        if (request.username() == null || request.username().isBlank()
                || request.password() == null || request.password().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "username and password are required"));
        }

        try {
            User user = authService.login(request.username(), request.password());
            String ledgerKey = authService.buildLedgerKey(user.getUsername());
            return ResponseEntity.ok(Map.of("ledgerKey", ledgerKey));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    public record RegisterRequest(String username, String password, String role) {
    }

    public record LoginRequest(String username, String password) {
    }
}
