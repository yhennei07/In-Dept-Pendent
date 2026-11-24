package com.talaan.ledger.controller;

import com.talaan.ledger.service.LedgerService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/ledger")
public class LedgerController {

    private final LedgerService ledgerService;

    public LedgerController(LedgerService ledgerService) {
        this.ledgerService = ledgerService;
    }

    @GetMapping
    public ResponseEntity<?> getLedger(@RequestParam(required = false) String username) {
        return ResponseEntity.ok(ledgerService.getLedger(username));
    }

    /**
     * Body shape per the frontend contract:
     *   { "username": "...", "action": { "type": "...", ... }, "snapshot": { ... } }
     *
     * `action` is accepted as a raw Map rather than a fixed DTO because its
     * shape varies by `type` (add/edit carry loan+borrower fields, payment
     * carries amount+method, archive/delete/restore/undo carry little or
     * nothing). `snapshot` (the client's locally-held copy of the ledger)
     * is accepted for contract compatibility but not required for
     * correctness — this backend is DB-authoritative and always recomputes
     * the response fresh from MySQL rather than trusting the client's
     * snapshot or diffing against it.
     */
    @PostMapping("/action")
    public ResponseEntity<?> applyAction(@RequestBody LedgerActionRequest request) {
        if (request.action() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "action is required"));
        }

        try {
            Map<String, Object> updatedLedger = ledgerService.applyAction(request.username(), request.action());
            return ResponseEntity.ok(updatedLedger);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    public record LedgerActionRequest(String username, Map<String, Object> action, Map<String, Object> snapshot) {
    }
}
