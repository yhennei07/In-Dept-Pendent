package com.talaan.ledger.model;

import java.time.LocalDateTime;

/**
 * Maps 1:1 to the existing `borrowers` table:
 *   borrowers (borrower_id, full_name, contact_number, address, created_at, barangay, is_archived)
 */
public class Borrower {

    private Long borrowerId;
    private String fullName;
    private String contactNumber;
    private String address;
    private LocalDateTime createdAt;
    private String barangay;
    private boolean archived;

    public Borrower() {
    }

    public Borrower(Long borrowerId, String fullName, String contactNumber, String address,
                     LocalDateTime createdAt, String barangay, boolean archived) {
        this.borrowerId = borrowerId;
        this.fullName = fullName;
        this.contactNumber = contactNumber;
        this.address = address;
        this.createdAt = createdAt;
        this.barangay = barangay;
        this.archived = archived;
    }

    public Long getBorrowerId() {
        return borrowerId;
    }

    public void setBorrowerId(Long borrowerId) {
        this.borrowerId = borrowerId;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getContactNumber() {
        return contactNumber;
    }

    public void setContactNumber(String contactNumber) {
        this.contactNumber = contactNumber;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getBarangay() {
        return barangay;
    }

    public void setBarangay(String barangay) {
        this.barangay = barangay;
    }

    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }
}
