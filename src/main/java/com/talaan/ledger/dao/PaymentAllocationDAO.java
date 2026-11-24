package com.talaan.ledger.dao;

import com.talaan.ledger.model.PaymentAllocation;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.util.List;

@Repository
public class PaymentAllocationDAO {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<PaymentAllocation> ROW_MAPPER = (rs, rowNum) -> new PaymentAllocation(
            rs.getLong("allocation_id"),
            rs.getLong("payment_id"),
            rs.getLong("installment_id"),
            rs.getBigDecimal("amount_allocated"),
            rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toLocalDateTime() : null
    );

    public PaymentAllocationDAO(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<PaymentAllocation> findByPaymentId(Long paymentId) {
        String sql = "SELECT allocation_id, payment_id, installment_id, amount_allocated, created_at "
                + "FROM payment_allocations WHERE payment_id = ? ORDER BY allocation_id ASC";
        return jdbcTemplate.query(sql, ROW_MAPPER, paymentId);
    }

    public void insert(Long paymentId, Long installmentId, BigDecimal amountAllocated) {
        String sql = "INSERT INTO payment_allocations (payment_id, installment_id, amount_allocated, created_at) "
                + "VALUES (?, ?, ?, NOW())";
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(sql);
            ps.setLong(1, paymentId);
            ps.setLong(2, installmentId);
            ps.setBigDecimal(3, amountAllocated);
            return ps;
        });
    }

    // No DELETE here, per project rule. When a payment is undone, the
    // allocation rows created by it are simply left in place as a harmless
    // historical record — LedgerService reverses their effect on the
    // installments table instead of removing the allocation rows.
}
