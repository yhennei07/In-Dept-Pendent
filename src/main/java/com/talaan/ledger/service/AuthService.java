package com.talaan.ledger.service;

import com.talaan.ledger.dao.UserDAO;
import com.talaan.ledger.model.User;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Handles registration and login against the existing `users` table.
 *
 * Password hashing uses BCrypt (org.springframework.security.crypto), not
 * hand-rolled SHA-256 + salt: BCrypt generates and stores its own salt
 * inside the resulting hash string and has an adaptive work factor, which
 * is the standard, safer choice for password storage. The `password_hash`
 * column just stores whatever string the encoder produces (BCrypt hashes
 * are ~60 chars — make sure that column is VARCHAR(60) or larger; since
 * schema changes are off the table here, flag this to the team if it's
 * currently narrower).
 */
@Service
public class AuthService {

    private final UserDAO userDAO;
    private final BCryptPasswordEncoder passwordEncoder;

    public AuthService(UserDAO userDAO) {
        this.userDAO = userDAO;
        this.passwordEncoder = new BCryptPasswordEncoder();
    }

    /**
     * Registers a new user.
     *
     * NOTE: per current project decision, this is called from an
     * admin-only endpoint — this method itself does not enforce that;
     * the controller/security layer is responsible for restricting who
     * can call it. See AuthController for the TODO on locking this down.
     *
     * @throws IllegalArgumentException if the username is already taken
     */
    public User register(String username, String rawPassword, String role) {
        if (userDAO.existsByUsername(username)) {
            throw new IllegalArgumentException("Username already exists: " + username);
        }

        String hashed = passwordEncoder.encode(rawPassword);
        Long id = userDAO.insert(username, hashed, role);

        return new User(id, username, hashed, role);
    }

    /**
     * Validates credentials.
     *
     * @return the matching User if the username exists and the password matches
     * @throws IllegalArgumentException if the username is unknown or the password is wrong
     */
    public User login(String username, String rawPassword) {
        Optional<User> maybeUser = userDAO.findByUsername(username);

        User user = maybeUser.orElseThrow(() ->
                new IllegalArgumentException("Invalid username or password"));

        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        return user;
    }

    /**
     * Builds the ledger key the frontend expects back from both
     * register and login: "account-ledger:" + username
     */
    public String buildLedgerKey(String username) {
        return "account-ledger:" + username;
    }
}
