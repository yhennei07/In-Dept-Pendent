package com.talaan.ledger.dao;

import com.talaan.ledger.model.Payment;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public class PaymentDAO {

    /**
     * The `payments` table has no void/status column, and the project rule
     * is "never DELETE". So an "undo payment" is implemented by prefixing
     * `remarks` with this tag (a plain UPDATE) and filtering tagged rows
     * out everywhere a payment history is read back. If you'd rather have
     * a real `is_voided` column, that's a one-column migration away — just
     * out of scope under the current "no schema changes" rule.
     */
    public static final String VOID_TAG = "[VOID] ";

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<Payment> ROW_MAPPER = (rs, rowNum) -> new Payment(
            rs.getLong("payment_id"),
            rs.getBigDecimal("amount"),
            rs.getTimestamp("payment_date") != null ? rs.getTimestamp("payment_date").toLocalDateTime() : null,
            rs.getString("remarks"),
            rs.getLong("loan_id"),
            rs.getBigDecimal("balance_after")
    );

    public PaymentDAO(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Payment> findByLoanId(Long loanId) {
        String sql = "SELECT payment_id, amount, payment_date, remarks, loan_id, balance_after "
                + "FROM payments WHERE loan_id = ? ORDER BY payment_date ASC, payment_id ASC";
        return jdbcTemplate.query(sql, ROW_MAPPER, loanId);
    }

    public Optional<Payment> findById(Long paymentId) {
        String sql = "SELECT payment_id, amount, payment_date, remarks, loan_id, balance_after "
                + "FROM payments WHERE payment_id = ?";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, ROW_MAPPER, paymentId));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Optional<Payment> findLastByLoanId(Long loanId) {
        String sql = "SELECT payment_id, amount, payment_date, remarks, loan_id, balance_after "
                + "FROM payments WHERE loan_id = ? ORDER BY payment_date DESC, payment_id DESC LIMIT 1";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, ROW_MAPPER, loanId));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Long insert(Long loanId, BigDecimal amount, LocalDateTime paymentDate, String remarks,
                        BigDecimal balanceAfter) {
        String sql = "INSERT INTO payments (amount, payment_date, remarks, loan_id, balance_after) "
                + "VALUES (?, ?, ?, ?, ?)";
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setBigDecimal(1, amount);
            ps.setTimestamp(2, Timestamp.valueOf(paymentDate));
            ps.setString(3, remarks);
            ps.setLong(4, loanId);
            ps.setBigDecimal(5, balanceAfter);
            return ps;
        }, keyHolder);

        Number key = keyHolder.getKey();
        return key != null ? key.longValue() : null;
    }

    /**
     * Soft-void via UPDATE (never DELETE) — see VOID_TAG above.
     */
    public void markVoided(Long paymentId, String originalRemarks) {
        String sql = "UPDATE payments SET remarks = ? WHERE payment_id = ?";
        String tagged = VOID_TAG + (originalRemarks == null ? "" : originalRemarks);
        jdbcTemplate.update(sql, tagged, paymentId);
    }

    public static boolean isVoided(Payment payment) {
        return payment.getRemarks() != null && payment.getRemarks().startsWith(VOID_TAG);
    }
}
