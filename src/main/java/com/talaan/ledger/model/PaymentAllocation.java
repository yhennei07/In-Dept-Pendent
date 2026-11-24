package com.talaan.ledger.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Maps 1:1 to the existing `payment_allocations` table:
 *   payment_allocations (allocation_id, payment_id, installment_id, amount_allocated, created_at)
 */
public class PaymentAllocation {

    private Long allocationId;
    private Long paymentId;
    private Long installmentId;
    private BigDecimal amountAllocated;
    private LocalDateTime createdAt;

    public PaymentAllocation() {
    }

    public PaymentAllocation(Long allocationId, Long paymentId, Long installmentId,
                              BigDecimal amountAllocated, LocalDateTime createdAt) {
        this.allocationId = allocationId;
        this.paymentId = paymentId;
        this.installmentId = installmentId;
        this.amountAllocated = amountAllocated;
        this.createdAt = createdAt;
    }

    public Long getAllocationId() {
        return allocationId;
    }

    public void setAllocationId(Long allocationId) {
        this.allocationId = allocationId;
    }

    public Long getPaymentId() {
        return paymentId;
    }

    public void setPaymentId(Long paymentId) {
        this.paymentId = paymentId;
    }

    public Long getInstallmentId() {
        return installmentId;
    }

    public void setInstallmentId(Long installmentId) {
        this.installmentId = installmentId;
    }

    public BigDecimal getAmountAllocated() {
        return amountAllocated;
    }

    public void setAmountAllocated(BigDecimal amountAllocated) {
        this.amountAllocated = amountAllocated;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
