package com.talaan.ledger.model;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Maps 1:1 to the existing `installments` table:
 *   installments (installment_id, loan_id, due_date, amount_due, amount_paid, status)
 *
 * `status` is a free-form VARCHAR(20) in the existing schema. This backend
 * uses the values: "UNPAID", "PARTIAL", "PAID", and the internal-only
 * "VOID" (used when an installment schedule is edited down to fewer rows
 * than currently exist — see LedgerService for why "VOID" exists instead
 * of a DELETE).
 */
public class Installment {

    private Long installmentId;
    private Long loanId;
    private LocalDate dueDate;
    private BigDecimal amountDue;
    private BigDecimal amountPaid;
    private String status;

    public Installment() {
    }

    public Installment(Long installmentId, Long loanId, LocalDate dueDate,
                        BigDecimal amountDue, BigDecimal amountPaid, String status) {
        this.installmentId = installmentId;
        this.loanId = loanId;
        this.dueDate = dueDate;
        this.amountDue = amountDue;
        this.amountPaid = amountPaid;
        this.status = status;
    }

    public Long getInstallmentId() {
        return installmentId;
    }

    public void setInstallmentId(Long installmentId) {
        this.installmentId = installmentId;
    }

    public Long getLoanId() {
        return loanId;
    }

    public void setLoanId(Long loanId) {
        this.loanId = loanId;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public BigDecimal getAmountDue() {
        return amountDue;
    }

    public void setAmountDue(BigDecimal amountDue) {
        this.amountDue = amountDue;
    }

    public BigDecimal getAmountPaid() {
        return amountPaid;
    }

    public void setAmountPaid(BigDecimal amountPaid) {
        this.amountPaid = amountPaid;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
