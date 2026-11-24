package com.talaan.ledger.dao;

import com.talaan.ledger.model.Installment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.List;

@Repository
public class InstallmentDAO {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<Installment> ROW_MAPPER = (rs, rowNum) -> new Installment(
            rs.getLong("installment_id"),
            rs.getLong("loan_id"),
            rs.getDate("due_date") != null ? rs.getDate("due_date").toLocalDate() : null,
            rs.getBigDecimal("amount_due"),
            rs.getBigDecimal("amount_paid"),
            rs.getString("status")
    );

    public InstallmentDAO(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Installment> findByLoanId(Long loanId) {
        String sql = "SELECT installment_id, loan_id, due_date, amount_due, amount_paid, status "
                + "FROM installments WHERE loan_id = ? ORDER BY due_date ASC, installment_id ASC";
        return jdbcTemplate.query(sql, ROW_MAPPER, loanId);
    }

    /**
     * Unpaid/partially-paid installments only, oldest due date first —
     * this is the order payments get allocated against.
     */
    public List<Installment> findOutstandingByLoanId(Long loanId) {
        String sql = "SELECT installment_id, loan_id, due_date, amount_due, amount_paid, status "
                + "FROM installments WHERE loan_id = ? AND status IN ('UNPAID', 'PARTIAL') "
                + "ORDER BY due_date ASC, installment_id ASC";
        return jdbcTemplate.query(sql, ROW_MAPPER, loanId);
    }

    /**
     * Inserts a new installment row and returns its generated installment_id.
     */
    public Long insertAndReturnId(Long loanId, LocalDate dueDate, BigDecimal amountDue) {
        String sql = "INSERT INTO installments (loan_id, due_date, amount_due, amount_paid, status) "
                + "VALUES (?, ?, ?, 0.00, 'UNPAID')";
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    sql, Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, loanId);
            ps.setDate(2, Date.valueOf(dueDate));
            ps.setBigDecimal(3, amountDue);
            return ps;
        }, keyHolder);

        Number key = keyHolder.getKey();
        return key != null ? key.longValue() : null;
    }

    /**
     * Used when editing a loan's schedule in place (no payments exist yet):
     * overwrites an existing row's due date and amount due, and resets it
     * to UNPAID/0 paid. Never used once a loan has payments.
     */
    public void overwriteSchedule(Long installmentId, LocalDate dueDate, BigDecimal amountDue) {
        String sql = "UPDATE installments SET due_date = ?, amount_due = ?, amount_paid = 0.00, "
                + "status = 'UNPAID' WHERE installment_id = ?";
        jdbcTemplate.update(sql, Date.valueOf(dueDate), amountDue, installmentId);
    }

    /**
     * Neutralizes a leftover installment row when a schedule is edited down
     * to fewer installments than currently exist. Never DELETEs the row —
     * it is zeroed out and marked VOID so it contributes nothing to any
     * balance/outstanding calculation.
     */
    public void voidOut(Long installmentId) {
        String sql = "UPDATE installments SET amount_due = 0.00, amount_paid = 0.00, status = 'VOID' "
                + "WHERE installment_id = ?";
        jdbcTemplate.update(sql, installmentId);
    }

    public void applyAllocation(Long installmentId, BigDecimal newAmountPaid, String newStatus) {
        String sql = "UPDATE installments SET amount_paid = ?, status = ? WHERE installment_id = ?";
        jdbcTemplate.update(sql, newAmountPaid, newStatus, installmentId);
    }
}
