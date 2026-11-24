package com.talaan.ledger.dao;

import com.talaan.ledger.model.Borrower;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.Optional;

@Repository
public class BorrowerDAO {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<Borrower> ROW_MAPPER = (rs, rowNum) -> new Borrower(
            rs.getLong("borrower_id"),
            rs.getString("full_name"),
            rs.getString("contact_number"),
            rs.getString("address"),
            rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toLocalDateTime() : null,
            rs.getString("barangay"),
            rs.getInt("is_archived") == 1
    );

    public BorrowerDAO(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<Borrower> findById(Long borrowerId) {
        String sql = "SELECT borrower_id, full_name, contact_number, address, created_at, barangay, is_archived "
                + "FROM borrowers WHERE borrower_id = ?";
        try {
            return Optional.ofNullable(jdbcTemplate.queryForObject(sql, ROW_MAPPER, borrowerId));
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    public Long insert(String fullName, String contactNumber, String address, String barangay) {
        String sql = "INSERT INTO borrowers (full_name, contact_number, address, created_at, barangay, is_archived) "
                + "VALUES (?, ?, ?, NOW(), ?, 0)";
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, fullName);
            ps.setString(2, contactNumber);
            ps.setString(3, address);
            ps.setString(4, barangay);
            return ps;
        }, keyHolder);

        Number key = keyHolder.getKey();
        return key != null ? key.longValue() : null;
    }

    /**
     * Updates borrower-identity fields only. Does not touch is_archived —
     * use archive(...)/restore(...) for that.
     */
    public void updateDetails(Long borrowerId, String fullName, String contactNumber, String barangay) {
        String sql = "UPDATE borrowers SET full_name = ?, contact_number = ?, barangay = ? WHERE borrower_id = ?";
        jdbcTemplate.update(sql, fullName, contactNumber, barangay, borrowerId);
    }

    /**
     * Soft-archive only. Never DELETE, per project rule.
     */
    public void archive(Long borrowerId) {
        String sql = "UPDATE borrowers SET is_archived = 1 WHERE borrower_id = ?";
        jdbcTemplate.update(sql, borrowerId);
    }

    public void restore(Long borrowerId) {
        String sql = "UPDATE borrowers SET is_archived = 0 WHERE borrower_id = ?";
        jdbcTemplate.update(sql, borrowerId);
    }
}
