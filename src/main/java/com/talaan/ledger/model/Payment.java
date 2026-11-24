package com.talaan.ledger.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Maps 1:1 to the existing `payments` table:
 *   payments (payment_id, amount, payment_date, remarks, loan_id, balance_after)
 *
 * There is no "voided"/status column on this table. Undo-of-payment is
 * implemented by tagging `remarks` with a "[VOID] " prefix (an UPDATE,
 * never a DELETE) and filtering those rows out when building the ledger
 * JSON. See LedgerService.isVoided(Payment) / PaymentDAO.markVoided(...).
 */
public class Payment {

    private Long paymentId;
    private BigDecimal amount;
    private LocalDateTime paymentDate;
    private String remarks;
    private Long loanId;
    private BigDecimal balanceAfter;

    public Payment() {
    }

    public Payment(Long paymentId, BigDecimal amount, LocalDateTime paymentDate,
                    String remarks, Long loanId, BigDecimal balanceAfter) {
        this.paymentId = paymentId;
        this.amount = amount;
        this.paymentDate = paymentDate;
        this.remarks = remarks;
        this.loanId = loanId;
        this.balanceAfter = balanceAfter;
    }

    public Long getPaymentId() {
        return paymentId;
    }

    public void setPaymentId(Long paymentId) {
        this.paymentId = paymentId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public LocalDateTime getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentDate(LocalDateTime paymentDate) {
        this.paymentDate = paymentDate;
    }

    public String getRemarks() {
        return remarks;
    }

    public void setRemarks(String remarks) {
        this.remarks = remarks;
    }

    public Long getLoanId() {
        return loanId;
    }

    public void setLoanId(Long loanId) {
        this.loanId = loanId;
    }

    public BigDecimal getBalanceAfter() {
        return balanceAfter;
    }

    public void setBalanceAfter(BigDecimal balanceAfter) {
        this.balanceAfter = balanceAfter;
    }
}
