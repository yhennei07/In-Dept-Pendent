package com.talaan.ledger.service;

import com.talaan.ledger.dao.BorrowerDAO;
import com.talaan.ledger.dao.InstallmentDAO;
import com.talaan.ledger.dao.LoanDAO;
import com.talaan.ledger.dao.PaymentAllocationDAO;
import com.talaan.ledger.dao.PaymentDAO;
import com.talaan.ledger.model.Borrower;
import com.talaan.ledger.model.Installment;
import com.talaan.ledger.model.Loan;
import com.talaan.ledger.model.Payment;
import com.talaan.ledger.model.PaymentAllocation;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Orchestrates Borrowers + Loans + Installments + Payments + Allocations
 * into the single `ledger` JSON shape the frontend (`ledger.mjs` /
 * `demo-store.mjs`) expects, and applies the five action types.
 *
 * ============================= ASSUMPTIONS ==============================
 * The exact source files (`ledger.mjs`, `demo-store.mjs`) were not
 * available when this was written. Two pieces of business math had to be
 * inferred from the prose spec rather than read off the original code —
 * both are isolated in single methods below so they're a one-line fix if
 * wrong:
 *
 *   1. totalAmountFor(principal, interestRatePercent) — assumes simple
 *      interest on the whole loan term: total = principal * (1 + rate/100).
 *
 *   2. dueDateForInstallment(loanDate, frequency, installmentNumber) —
 *      assumes daily/weekly/fortnightly/monthly periods counted forward
 *      from the loan date (installment #1 is one period after loanDate).
 *
 * The regular/final split itself ("regular rounded to whole pesos, final
 * = total - regular*(count-1)") is exactly as specified.
 *
 * ========================== STATE DURABILITY =============================
 * `revision` and `lastAction` (and therefore "undo") are tracked only in
 * an in-memory field on this singleton service bean. They are NOT backed
 * by any table (none exists in the fixed schema for this), so:
 *   - They reset to 0/null on every application restart.
 *   - They are NOT safe if you ever run more than one backend instance.
 *   - "undo" only ever reverses the single most recent mutating action
 *     taken since the last restart — there is no multi-level undo stack.
 * If you need durable, multi-instance-safe audit/undo, that needs a new
 * table (e.g. `ledger_actions`), which is a schema change and therefore
 * out of scope unless you ask for it explicitly.
 * ==========================================================================
 */
@Service
public class LedgerService {

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final int TL_ID_OFFSET = 1000;

    private final BorrowerDAO borrowerDAO;
    private final LoanDAO loanDAO;
    private final InstallmentDAO installmentDAO;
    private final PaymentDAO paymentDAO;
    private final PaymentAllocationDAO paymentAllocationDAO;

    // In-memory only — see class javadoc above.
    private final AtomicLong revision = new AtomicLong(0);
    private final AtomicReference<Map<String, Object>> lastAction = new AtomicReference<>(null);
    private final AtomicReference<UndoableAction> undoStack = new AtomicReference<>(null);

    public LedgerService(BorrowerDAO borrowerDAO, LoanDAO loanDAO, InstallmentDAO installmentDAO,
                          PaymentDAO paymentDAO, PaymentAllocationDAO paymentAllocationDAO) {
        this.borrowerDAO = borrowerDAO;
        this.loanDAO = loanDAO;
        this.installmentDAO = installmentDAO;
        this.paymentDAO = paymentDAO;
        this.paymentAllocationDAO = paymentAllocationDAO;
    }

    // ======================================================================
    // GET /api/ledger
    // ======================================================================

    /**
     * NOTE ON `username`: the schema has no column anywhere linking a loan
     * or borrower to a user account, and no per-user data to filter by.
     * This is implemented as ONE SHARED ledger for every authenticated
     * user (consistent with this being a single lending book for the
     * business, not per-user private data) — `username` is accepted for
     * API-contract compatibility / future auditing, but does not filter
     * the result set. If you actually need per-user ledgers, the `loans`
     * or `borrowers` table needs an owner column, which is a schema
     * change and out of scope here.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getLedger(String username) {
        return buildSnapshot();
    }

    private Map<String, Object> buildSnapshot() {
        List<Loan> loans = loanDAO.findAll();

        List<Map<String, Object>> loanJsonList = new ArrayList<>();
        for (Loan loan : loans) {
            loanJsonList.add(toLoanJson(loan));
        }

        Long maxLoanId = loanDAO.findMaxLoanId();
        long nextId = (maxLoanId != null) ? (TL_ID_OFFSET + maxLoanId + 1) : (TL_ID_OFFSET + 1);

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("revision", revision.get());
        snapshot.put("nextId", nextId);
        snapshot.put("lastAction", lastAction.get());
        snapshot.put("loans", loanJsonList);
        return snapshot;
    }

    private Map<String, Object> toLoanJson(Loan loan) {
        Borrower borrower = borrowerDAO.findById(loan.getBorrowerId()).orElse(null);

        Map<String, Object> json = new LinkedHashMap<>();
        json.put("id", formatLoanId(loan.getLoanId()));
        json.put("name", borrower != null ? borrower.getFullName() : null);
        json.put("barangay", borrower != null ? borrower.getBarangay() : null);
        json.put("contact", borrower != null ? borrower.getContactNumber() : null);
        json.put("principal", pesosToCentavos(loan.getPrincipal()));
        json.put("interest", percentToBasisPoints(loan.getInterestRate()));
        json.put("count", loan.getNumPayments());
        json.put("frequency", loan.getPaymentFrequency());
        json.put("start", loan.getLoanDate() != null ? loan.getLoanDate().format(ISO_DATE) : null);
        json.put("archived", loan.isArchived()
                ? (loan.getArchivedAt() != null ? loan.getArchivedAt().toLocalDate().format(ISO_DATE) : null)
                : null);
        json.put("revision", revision.get());
        json.put("payments", buildPaymentsJson(loan.getLoanId()));
        return json;
    }

    private List<Map<String, Object>> buildPaymentsJson(Long loanId) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Payment payment : paymentDAO.findByLoanId(loanId)) {
            if (PaymentDAO.isVoided(payment)) {
                continue; // voided payments are excluded from the visible ledger
            }
            Map<String, Object> paymentJson = new LinkedHashMap<>();
            paymentJson.put("date", payment.getPaymentDate() != null
                    ? payment.getPaymentDate().toLocalDate().format(ISO_DATE) : null);
            paymentJson.put("amount", pesosToCentavos(payment.getAmount()));
            paymentJson.put("method", payment.getRemarks());
            result.add(paymentJson);
        }
        return result;
    }

    // ======================================================================
    // POST /api/ledger/action
    // ======================================================================

    @Transactional
    public Map<String, Object> applyAction(String username, Map<String, Object> action) {
        if (action == null || action.get("type") == null) {
            throw new IllegalArgumentException("action.type is required");
        }
        String type = String.valueOf(action.get("type"));

        switch (type) {
            case "add" -> doAdd(action);
            case "edit" -> doEdit(action);
            case "payment" -> doPayment(action);
            case "archive", "delete" -> doArchive(action);
            case "restore" -> doRestore(action);
            case "undo" -> doUndo();
            default -> throw new IllegalArgumentException("Unknown action type: " + type);
        }

        revision.incrementAndGet();
        return buildSnapshot();
    }

    // ---- add ----------------------------------------------------------

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractFields(Map<String, Object> action) {
        Object fieldsObj = action.get("fields");
        if (fieldsObj instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return action;
    }

    private void doAdd(Map<String, Object> action) {
        Map<String, Object> fields = extractFields(action);
        String name = requiredString(fields, "name");
        String barangay = optionalString(fields, "barangay");
        String contact = optionalString(fields, "contact");
        long principalCentavos = requiredLong(fields, "principal");
        long interestBasisPoints = requiredLong(fields, "interest");
        int count = (int) requiredLong(fields, "count");
        String frequency = requiredString(fields, "frequency");
        LocalDate start = LocalDate.parse(requiredString(fields, "start"), ISO_DATE);

        if (count <= 0) {
            throw new IllegalArgumentException("count must be greater than 0");
        }

        BigDecimal principal = centavosToPesos(principalCentavos);
        BigDecimal interestRate = basisPointsToPercent(interestBasisPoints);
        BigDecimal totalAmount = totalAmountFor(principal, interestRate);

        Long borrowerId = borrowerDAO.insert(name, contact, null, barangay);

        List<ScheduleLine> schedule = buildSchedule(start, frequency, count, totalAmount);
        LocalDate finalDueDate = schedule.get(schedule.size() - 1).dueDate();

        Long loanId = loanDAO.insert(borrowerId, principal, interestRate, totalAmount, start, finalDueDate,
                frequency, "ACTIVE", count);

        for (ScheduleLine line : schedule) {
            installmentDAO.insertAndReturnId(loanId, line.dueDate(), line.amountDue());
        }

        recordLastAction("add", loanId, null);
    }

    // ---- edit -----------------------------------------------------------

    private void doEdit(Map<String, Object> action) {
        Long loanId = parseLoanId(requiredString(action, "id"));
        Map<String, Object> fields = extractFields(action);
        Loan loan = loanDAO.findById(loanId)
                .orElseThrow(() -> new IllegalArgumentException("No such loan: " + action.get("id")));

        String name = optionalString(fields, "name");
        String barangay = optionalString(fields, "barangay");
        String contact = optionalString(fields, "contact");
        if (name != null || barangay != null || contact != null) {
            Borrower borrower = borrowerDAO.findById(loan.getBorrowerId())
                    .orElseThrow(() -> new IllegalStateException("Borrower missing for loan " + loanId));
            borrowerDAO.updateDetails(
                    loan.getBorrowerId(),
                    name != null ? name : borrower.getFullName(),
                    contact != null ? contact : borrower.getContactNumber(),
                    barangay != null ? barangay : borrower.getBarangay()
            );
        }

        boolean hasPayments = !paymentDAO.findByLoanId(loanId).isEmpty();
        boolean wantsCoreEdit = fields.containsKey("principal") || fields.containsKey("interest")
                || fields.containsKey("count") || fields.containsKey("frequency") || fields.containsKey("start");

        if (wantsCoreEdit) {
            if (hasPayments) {
                throw new IllegalStateException(
                        "Cannot edit loan terms after payments exist for loan " + action.get("id"));
            }

            BigDecimal principal = fields.containsKey("principal")
                    ? centavosToPesos(requiredLong(fields, "principal")) : loan.getPrincipal();
            BigDecimal interestRate = fields.containsKey("interest")
                    ? basisPointsToPercent(requiredLong(fields, "interest")) : loan.getInterestRate();
            int count = fields.containsKey("count") ? (int) requiredLong(fields, "count") : loan.getNumPayments();
            String frequency = fields.containsKey("frequency")
                    ? requiredString(fields, "frequency") : loan.getPaymentFrequency();
            LocalDate start = fields.containsKey("start")
                    ? LocalDate.parse(requiredString(fields, "start"), ISO_DATE) : loan.getLoanDate();

            BigDecimal totalAmount = totalAmountFor(principal, interestRate);
            List<ScheduleLine> schedule = buildSchedule(start, frequency, count, totalAmount);
            LocalDate finalDueDate = schedule.get(schedule.size() - 1).dueDate();

            applyScheduleInPlace(loanId, schedule);

            loanDAO.updateCoreFields(loanId, principal, interestRate, totalAmount, start, finalDueDate,
                    frequency, count);
        }

        recordLastAction("edit", loanId, null);
    }

    /**
     * Rewrites the installment schedule for a loan that has zero payments,
     * without ever issuing a DELETE: existing rows are overwritten in
     * place; extra rows needed are inserted; rows no longer needed are
     * neutralized via voidOut(...) rather than removed.
     */
    private void applyScheduleInPlace(Long loanId, List<ScheduleLine> newSchedule) {
        List<Installment> existing = installmentDAO.findByLoanId(loanId);
        existing.sort(Comparator.comparing(Installment::getDueDate).thenComparing(Installment::getInstallmentId));

        int i = 0;
        for (; i < newSchedule.size() && i < existing.size(); i++) {
            ScheduleLine line = newSchedule.get(i);
            installmentDAO.overwriteSchedule(existing.get(i).getInstallmentId(), line.dueDate(), line.amountDue());
        }
        for (; i < newSchedule.size(); i++) {
            ScheduleLine line = newSchedule.get(i);
            installmentDAO.insertAndReturnId(loanId, line.dueDate(), line.amountDue());
        }
        for (; i < existing.size(); i++) {
            installmentDAO.voidOut(existing.get(i).getInstallmentId());
        }
    }

    // ---- payment ----------------------------------------------------------

    private void doPayment(Map<String, Object> action) {
        Long loanId = parseLoanId(requiredString(action, "id"));
        Loan loan = loanDAO.findById(loanId)
                .orElseThrow(() -> new IllegalArgumentException("No such loan: " + action.get("id")));

        long amountCentavos = requiredLong(action, "amount");
        String method = optionalString(action, "method");
        BigDecimal amount = centavosToPesos(amountCentavos);

        BigDecimal balanceBefore = outstandingBalance(loan);
        BigDecimal balanceAfter = balanceBefore.subtract(amount).max(BigDecimal.ZERO);

        Long paymentId = paymentDAO.insert(loanId, amount, LocalDateTime.now(), method, balanceAfter);

        allocatePayment(loanId, paymentId, amount);

        loanDAO.updateStatus(loanId, balanceAfter.compareTo(BigDecimal.ZERO) <= 0 ? "CLOSED" : "ACTIVE");

        recordLastAction("payment", loanId, paymentId);
    }

    /**
     * Allocates a payment sequentially across outstanding installments,
     * oldest due date first, per the spec.
     */
    private void allocatePayment(Long loanId, Long paymentId, BigDecimal amount) {
        BigDecimal remaining = amount;
        for (Installment installment : installmentDAO.findOutstandingByLoanId(loanId)) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
                break;
            }
            BigDecimal due = installment.getAmountDue().subtract(installment.getAmountPaid());
            if (due.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            BigDecimal allocation = remaining.min(due);
            BigDecimal newAmountPaid = installment.getAmountPaid().add(allocation);
            String newStatus = newAmountPaid.compareTo(installment.getAmountDue()) >= 0 ? "PAID" : "PARTIAL";

            installmentDAO.applyAllocation(installment.getInstallmentId(), newAmountPaid, newStatus);
            paymentAllocationDAO.insert(paymentId, installment.getInstallmentId(), allocation);

            remaining = remaining.subtract(allocation);
        }
        // Any `remaining` left over (overpayment beyond the full schedule)
        // is intentionally not allocated anywhere further — it simply
        // shows up as a negative/zero balanceAfter on the payment record.
    }

    private BigDecimal outstandingBalance(Loan loan) {
        List<Payment> payments = new ArrayList<>();
        for (Payment payment : paymentDAO.findByLoanId(loan.getLoanId())) {
            if (!PaymentDAO.isVoided(payment)) {
                payments.add(payment);
            }
        }
        payments.sort(Comparator.comparing(Payment::getPaymentDate));

        BigDecimal totalWithPenalty = loan.getTotalAmount();
        BigDecimal paid = BigDecimal.ZERO;
        LocalDate lastDueDate = loan.getDueDate();
        LocalDate cursorDate = lastDueDate;
        LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Manila"));

        for (Payment payment : payments) {
            LocalDate payDate = payment.getPaymentDate().toLocalDate();
            BigDecimal remainingBefore = totalWithPenalty.subtract(paid).max(BigDecimal.ZERO);
            if (lastDueDate != null && payDate.isAfter(cursorDate) && remainingBefore.compareTo(BigDecimal.ZERO) > 0) {
                long days = java.time.temporal.ChronoUnit.DAYS.between(cursorDate, payDate);
                BigDecimal penalty = remainingBefore
                        .multiply(new BigDecimal("0.01"))
                        .multiply(BigDecimal.valueOf(days))
                        .setScale(2, RoundingMode.HALF_UP);
                totalWithPenalty = totalWithPenalty.add(penalty);
                cursorDate = payDate;
            }
            paid = paid.add(payment.getAmount());
        }

        BigDecimal remainingBeforeToday = totalWithPenalty.subtract(paid).max(BigDecimal.ZERO);
        if (lastDueDate != null && today.isAfter(cursorDate) && remainingBeforeToday.compareTo(BigDecimal.ZERO) > 0) {
            long days = java.time.temporal.ChronoUnit.DAYS.between(cursorDate, today);
            BigDecimal penalty = remainingBeforeToday
                    .multiply(new BigDecimal("0.01"))
                    .multiply(BigDecimal.valueOf(days))
                    .setScale(2, RoundingMode.HALF_UP);
            totalWithPenalty = totalWithPenalty.add(penalty);
        }

        return totalWithPenalty.subtract(paid).max(BigDecimal.ZERO);
    }


    // ---- archive / delete / restore ---------------------------------------

    private void doArchive(Map<String, Object> action) {
        Long loanId = parseLoanId(requiredString(action, "id"));
        Loan loan = loanDAO.findById(loanId)
                .orElseThrow(() -> new IllegalArgumentException("No such loan: " + action.get("id")));

        // Per the current spec, both "archive" and "delete" archive the
        // borrower row as well as the loan row. CAVEAT: if this borrower
        // has other, still-active loans, this will archive them out of
        // view too, since is_archived lives on `borrowers` and there is
        // no per-loan visibility of the borrower otherwise. If that's not
        // desired, say so and this can be changed to archive the loan only.
        borrowerDAO.archive(loan.getBorrowerId());
        loanDAO.archive(loanId);

        recordLastAction("archive", loanId, null);
    }

    private void doRestore(Map<String, Object> action) {
        Long loanId = parseLoanId(requiredString(action, "id"));
        Loan loan = loanDAO.findById(loanId)
                .orElseThrow(() -> new IllegalArgumentException("No such loan: " + action.get("id")));

        borrowerDAO.restore(loan.getBorrowerId());
        loanDAO.restore(loanId);

        recordLastAction("restore", loanId, null);
    }

    // ---- undo ---------------------------------------------------------

    private void doUndo() {
        UndoableAction toUndo = undoStack.getAndSet(null);
        if (toUndo == null) {
            throw new IllegalStateException("Nothing to undo");
        }

        switch (toUndo.type()) {
            case "payment" -> undoPayment(toUndo.loanId(), toUndo.paymentId());
            case "archive" -> {
                borrowerDAO.restore(loanDAO.findById(toUndo.loanId())
                        .map(Loan::getBorrowerId).orElseThrow());
                loanDAO.restore(toUndo.loanId());
            }
            default -> throw new IllegalStateException("Cannot undo action of type: " + toUndo.type());
        }

        recordLastAction("undo", toUndo.loanId(), null);
    }

    private void undoPayment(Long loanId, Long paymentId) {
        Payment payment = paymentDAO.findById(paymentId)
                .orElseThrow(() -> new IllegalStateException("Payment to undo no longer exists: " + paymentId));

        // Reverse every allocation this payment made.
        for (PaymentAllocation allocation : paymentAllocationDAO.findByPaymentId(paymentId)) {
            installmentDAO.findByLoanId(loanId).stream()
                    .filter(i -> i.getInstallmentId().equals(allocation.getInstallmentId()))
                    .findFirst()
                    .ifPresent(installment -> {
                        BigDecimal revertedPaid = installment.getAmountPaid()
                                .subtract(allocation.getAmountAllocated())
                                .max(BigDecimal.ZERO);
                        String newStatus = revertedPaid.compareTo(BigDecimal.ZERO) <= 0 ? "UNPAID" : "PARTIAL";
                        installmentDAO.applyAllocation(installment.getInstallmentId(), revertedPaid, newStatus);
                    });
        }
        // payment_allocations rows for this payment are intentionally left
        // in place (no DELETE) — they're now orphaned historical rows with
        // no visible effect, since the payment itself is voided below.

        paymentDAO.markVoided(paymentId, payment.getRemarks());

        Loan loan = loanDAO.findById(loanId).orElseThrow();
        BigDecimal balanceAfter = outstandingBalance(loan);
        loanDAO.updateStatus(loanId, balanceAfter.compareTo(BigDecimal.ZERO) <= 0 ? "CLOSED" : "ACTIVE");
    }

    private void recordLastAction(String type, Long loanId, Long paymentId) {
        Map<String, Object> descriptor = new LinkedHashMap<>();
        descriptor.put("type", type);
        descriptor.put("id", formatLoanId(loanId));
        descriptor.put("at", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
        lastAction.set(descriptor);

        // Only "payment" and "archive" are currently undoable (per spec).
        if ("payment".equals(type) || "archive".equals(type)) {
            undoStack.set(new UndoableAction(type, loanId, paymentId));
        } else if (!"undo".equals(type)) {
            // Any other mutating action invalidates the single-level undo
            // stack, since it may no longer be safe/meaningful to reverse
            // the older action on top of a newer one.
            undoStack.set(null);
        }
    }

    // ======================================================================
    // Schedule generation (ASSUMPTION — see class javadoc)
    // ======================================================================

    private record ScheduleLine(LocalDate dueDate, BigDecimal amountDue) {
    }

    private List<ScheduleLine> buildSchedule(LocalDate start, String frequency, int count, BigDecimal totalAmount) {
        BigDecimal regular = totalAmount
                .divide(BigDecimal.valueOf(count), 0, RoundingMode.HALF_UP)
                .setScale(2, RoundingMode.UNNECESSARY);
        BigDecimal finalInstallment = totalAmount.subtract(regular.multiply(BigDecimal.valueOf(count - 1)));

        List<ScheduleLine> lines = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            LocalDate dueDate = dueDateForInstallment(start, frequency, i);
            BigDecimal amount = (i == count - 1) ? finalInstallment : regular;
            lines.add(new ScheduleLine(dueDate, amount));
        }
        return lines;
    }

    /**
     * ASSUMPTION: installment #1 falls one period after the loan date;
     * each subsequent installment is one further period on. Adjust this
     * method if your actual ledger.mjs schedules differently (e.g. first
     * installment due ON the loan date).
     */
    private LocalDate dueDateForInstallment(LocalDate loanDate, String frequency, int installmentIndex) {
        return switch (frequency.toLowerCase()) {
            case "daily" -> loanDate.plusDays(installmentIndex);
            case "weekly" -> loanDate.plusWeeks(installmentIndex);
            case "fortnightly" -> loanDate.plusDays(15L * installmentIndex);
            case "monthly" -> loanDate.plusMonths(installmentIndex);
            default -> throw new IllegalArgumentException("Unknown payment_frequency: " + frequency);
        };
    }

    /**
     * ASSUMPTION: simple interest over the whole loan term —
     * total = principal * (1 + rate/100). Adjust if your actual formula
     * (e.g. per-period compounding) differs.
     */
    private BigDecimal totalAmountFor(BigDecimal principal, BigDecimal interestRatePercent) {
        BigDecimal multiplier = BigDecimal.ONE.add(interestRatePercent.divide(BigDecimal.valueOf(100), 10,
                RoundingMode.HALF_UP));
        return principal.multiply(multiplier).setScale(2, RoundingMode.HALF_UP);
    }

    // ======================================================================
    // Small helpers: money conversion, id formatting, request parsing
    // ======================================================================

    private String formatLoanId(Long loanId) {
        return loanId == null ? null : "TL-" + (TL_ID_OFFSET + loanId);
    }

    private Long parseLoanId(String tlId) {
        if (tlId == null || !tlId.startsWith("TL-")) {
            throw new IllegalArgumentException("Invalid loan id: " + tlId);
        }
        long numeric = Long.parseLong(tlId.substring(3));
        return numeric - TL_ID_OFFSET;
    }

    private BigDecimal centavosToPesos(long centavos) {
        return BigDecimal.valueOf(centavos).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    private long pesosToCentavos(BigDecimal pesos) {
        return pesos == null ? 0L : pesos.multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    private BigDecimal basisPointsToPercent(long basisPoints) {
        return BigDecimal.valueOf(basisPoints).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    private long percentToBasisPoints(BigDecimal percent) {
        return percent == null ? 0L : percent.multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }

    private String requiredString(Map<String, Object> action, String key) {
        Object value = action.get(key);
        if (value == null || String.valueOf(value).isBlank()) {
            throw new IllegalArgumentException("Missing required field: " + key);
        }
        return String.valueOf(value);
    }

    private String optionalString(Map<String, Object> action, String key) {
        Object value = action.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private long requiredLong(Map<String, Object> action, String key) {
        Object value = action.get(key);
        if (value == null) {
            throw new IllegalArgumentException("Missing required field: " + key);
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(String.valueOf(value));
    }

    private record UndoableAction(String type, Long loanId, Long paymentId) {
    }
}
