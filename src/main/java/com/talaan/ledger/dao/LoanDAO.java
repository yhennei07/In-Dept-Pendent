package com.talaan.ledger.dao;

import com.talaan.ledger.model.Loan;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public class LoanDAO {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<Loan> ROW_MAPPER = (rs, rowNum) -> {
        Loan loan = new Loan();
        loan.setLoanId(rs.getLong("loan_id"));
        loan.setBorrowerId(rs.getLong("borrower_id"));
        loan.setPrincipal(rs.getBigDecimal("principal"));
        loan.setInterestRate(rs.getBigDecimal("interest_rate"));
        loan.setTotalAmount(rs.getBigDecimal("total_amount"));
        loan.setLoanDate(rs.getDate("loan_date") != null ? rs.getDate("loan_date").toLocalDate() : null);
        loan.setDueDate(rs.getDate("due_date") != null ? rs.getDate("due_date").toLocalDate() : null);
        loan.setPaymentFrequency(rs.getString("payment_frequency"));
        loan.setStatus(rs.getString("status"));
        loan.setArchived(rs.getInt("is_archived") == 1);
        loan.setNumPayments(rs.getInt("num_payments"));
        Timestamp archivedAt = rs.getTimestamp("archived_at");
        loan.setArchivedAt(archivedAt != null ? archivedAt.toLocalDateTime() : null);
        return loan;
    };

    public LoanDAO(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Loan> findAll() {
        String sql = "SELECT loan_id, borrower_id, principal, interest_rate, total_amount, loan_date, "
                + "due_date, payment_frequency, status, is_archived, num_payments, archived_at "
                + "FROM loans ORDER BY loan_id";
        return jdbcTemplate.query(sql, ROW_MAPPER);
    }

    public Optional<Loan> findById(Long loanId) {
        String sql = "SELECT loan_id, borrower_id, principal, interest_rate, total_amount, loan_date, "
                + "due_date, payment_frequency, status, is_archived, num_payments, archived_at "
                + "FROM loans WHERE loan_id = ?";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, ROW_MAPPER, loanId));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    /**
     * Highest existing loan_id, or null if the table is empty. Used by
     * LedgerService to compute the ledger's "nextId" field.
     */
    public Long findMaxLoanId() {
        String sql = "SELECT MAX(loan_id) FROM loans";
        return jdbcTemplate.queryForObject(sql, Long.class);
    }

    public Long insert(Long borrowerId, BigDecimal principal, BigDecimal interestRate, BigDecimal totalAmount,
                        LocalDate loanDate, LocalDate dueDate, String paymentFrequency, String status,
                        int numPayments) {
        String sql = "INSERT INTO loans (borrower_id, principal, interest_rate, total_amount, loan_date, "
                + "due_date, payment_frequency, status, is_archived, num_payments, archived_at) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL)";
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, borrowerId);
            ps.setBigDecimal(2, principal);
            ps.setBigDecimal(3, interestRate);
            ps.setBigDecimal(4, totalAmount);
            ps.setDate(5, Date.valueOf(loanDate));
            ps.setDate(6, Date.valueOf(dueDate));
            ps.setString(7, paymentFrequency);
            ps.setString(8, status);
            ps.setInt(9, numPayments);
            return ps;
        }, keyHolder);

        Number key = keyHolder.getKey();
        return key != null ? key.longValue() : null;
    }

    /**
     * Updates the loan's own editable fields (used only when no payments
     * exist yet for the loan — LedgerService enforces that precondition).
     */
    public void updateCoreFields(Long loanId, BigDecimal principal, BigDecimal interestRate,
                                  BigDecimal totalAmount, LocalDate loanDate, LocalDate dueDate,
                                  String paymentFrequency, int numPayments) {
        String sql = "UPDATE loans SET principal = ?, interest_rate = ?, total_amount = ?, loan_date = ?, "
                + "due_date = ?, payment_frequency = ?, num_payments = ? WHERE loan_id = ?";
        jdbcTemplate.update(sql, principal, interestRate, totalAmount, Date.valueOf(loanDate),
                Date.valueOf(dueDate), paymentFrequency, numPayments, loanId);
    }

    public void updateStatus(Long loanId, String status) {
        String sql = "UPDATE loans SET status = ? WHERE loan_id = ?";
        jdbcTemplate.update(sql, status, loanId);
    }

    /**
     * Soft-archive only. Never DELETE, per project rule.
     */
    public void archive(Long loanId) {
        String sql = "UPDATE loans SET is_archived = 1, archived_at = NOW() WHERE loan_id = ?";
        jdbcTemplate.update(sql, loanId);
    }

    public void restore(Long loanId) {
        String sql = "UPDATE loans SET is_archived = 0, archived_at = NULL WHERE loan_id = ?";
        jdbcTemplate.update(sql, loanId);
    }
}
