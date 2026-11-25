export const TODAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
}).format(new Date());

export const FREQUENCIES = {
  daily: "Daily",
  weekly: "Weekly",
  fortnightly: "Every 15 days",
  monthly: "Monthly",
};

export const PAYMENT_METHODS = Object.freeze({
  cash: "Cash",
  gcash: "GCash",
  maya: "Maya",
  bank: "Bank transfer",
  other: "Other",
});

export function validPaymentMethod(method) {
  return typeof method === "string" && Object.hasOwn(PAYMENT_METHODS, method);
}

export function paymentMethodLabel(method) {
  return validPaymentMethod(method) ? PAYMENT_METHODS[method] : "Not specified";
}

const INTERVAL_DAYS = { daily: 1, weekly: 7, fortnightly: 15 };
const DAY_MS = 86_400_000;
const PESO = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});
const SHORT_DATE = new Intl.DateTimeFormat("en-PH", {
  month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
});

export function money(cents) {
  return PESO.format(cents / 100);
}

export function readableDate(date) {
  return date ? SHORT_DATE.format(new Date(date + "T00:00:00Z")) : "—";
}

function isoDate(date) {
  return date.toISOString().split("T")[0];
}

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && isoDate(date) === value;
}

export function parseHundredths(value) {
  const text = String(value).trim();
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount < 1_000_000_000_000_000 ? amount : null;
}

export function validContact(value) {
  const digits = value.replace(/[().\s-]/g, "");
  return /^(?:09\d{9}|0[2-8]\d{8}|0[3-8]\d{9}|\+[1-9]\d{7,14})$/.test(digits);
}

export function dueDate(start, frequency, index) {
  const date = new Date(start + "T00:00:00Z");
  if (frequency === "monthly") {
    const day = date.getUTCDate();
    date.setUTCMonth(date.getUTCMonth() + index, 1);
    const last = new Date(date);
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    date.setUTCDate(Math.min(day, last.getUTCDate()));
  } else {
    date.setUTCDate(date.getUTCDate() + INTERVAL_DAYS[frequency] * index);
  }
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() > 9999) return null;
  return isoDate(date);
}

export function calculateTerms({ principal, interest, count, frequency, start }) {
  if (!Number.isSafeInteger(principal) || principal <= 0 ||
    !Number.isSafeInteger(interest) || interest < 0 ||
    !Number.isSafeInteger(count) || count < 1 ||
    !Object.hasOwn(FREQUENCIES, frequency) || !validDate(start)) return null;

  const subtotal = BigInt(principal) * (10_000n + BigInt(interest));
  const total = Number((subtotal + 5_000n) / 10_000n);
  if (!Number.isSafeInteger(total) || total >= 1_000_000_000_000_000) {
    return { error: "Enter a smaller loan amount or interest rate." };
  }
  const divisor = BigInt(count) * 100n;
  const regular = count === 1 ? total : Number((BigInt(total) * 2n + divisor) / (2n * divisor)) * 100;
  const final = total - regular * (count - 1);
  const last = dueDate(start, frequency, count - 1);
  if (!last || regular <= 0 || final <= 0) {
    return { error: "Reduce the number of payments to keep each installment positive and within the calendar." };
  }
  return { total, regular, final, count, start, frequency, last };
}

function dueCount(terms, today) {
  let low = 0;
  let high = terms.count;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (dueDate(terms.start, terms.frequency, mid) <= today) low = mid + 1;
    else high = mid;
  }
  return low;
}

export const OVERDUE_DAILY_RATE_BPS = 100; // 1.00% per day after final due date

function calculateOverdueInterest(baseBalance, lastDueDate, fromDate, toDate) {
  if (baseBalance <= 0 || !lastDueDate || toDate <= lastDueDate) return 0;
  const start = fromDate > lastDueDate ? fromDate : lastDueDate;
  if (toDate <= start) return 0;
  const days = Math.round((Date.parse(toDate) - Date.parse(start)) / DAY_MS);
  if (days <= 0) return 0;
  return Math.round((baseBalance * OVERDUE_DAILY_RATE_BPS * days) / 10_000);
}

export function loanPosition(terms, paid, today = TODAY, accruedPenalty = 0) {
  const effectiveTotal = terms.total + accruedPenalty;
  const covered = paid >= effectiveTotal ? terms.count : Math.min(terms.count - 1, Math.floor(paid / terms.regular));
  const nextDue = covered === terms.count ? null : dueDate(terms.start, terms.frequency, covered);
  const due = dueCount(terms, today);
  const expected = due === terms.count ? effectiveTotal : due * terms.regular;
  const amountDue = Math.max(0, expected - paid);
  const balance = Math.max(0, effectiveTotal - paid);
  const overdue = amountDue > 0 && nextDue && nextDue < today
    ? Math.round((Date.parse(today) - Date.parse(nextDue)) / DAY_MS)
    : 0;
  const postMaturityDays = balance > 0 && terms.last && today > terms.last
    ? Math.round((Date.parse(today) - Date.parse(terms.last)) / DAY_MS)
    : 0;
  return {
    paid, balance, covered, nextDue, amountDue, overdue,
    overdueInterest: accruedPenalty,
    postMaturityDays,
    effectiveTotal,
    dueToday: nextDue === today && balance > 0,
    status: balance === 0 ? "Closed" : overdue ? "Overdue" : "Ongoing",
  };
}

const fixtures = [];

export function initialLedger(includeSamples = true) {
  const samples = includeSamples ? fixtures : [];
  return {
    revision: 0,
    nextId: 1001 + samples.length,
    lastAction: null,
    loans: samples.map(({ payments, ...loan }, index) => ({
      ...loan,
      id: "TL-" + (1001 + index),
      contact: "0900 000 " + String(index + 101).padStart(4, "0"),
      archived: loan.archived ?? null,
      revision: 0,
      payments: payments.map(([date, amount]) => ({ date, amount })),
    })),
  };
}

export function projectLoan(loan, today = TODAY) {
  if (typeof today !== "string") today = TODAY;
  const terms = calculateTerms(loan);
  let paid = 0;
  let accruedPenalty = 0;
  let cursorDate = terms.last;

  const history = [...loan.payments].sort((a, b) => a.date.localeCompare(b.date)).map(({ date, amount, method }) => {
    const baseRemainingBefore = Math.max(0, terms.total + accruedPenalty - paid);
    if (date > cursorDate && baseRemainingBefore > 0) {
      accruedPenalty += calculateOverdueInterest(baseRemainingBefore, terms.last, cursorDate, date);
      cursorDate = date;
    }
    const { amountDue } = loanPosition(terms, paid, date, accruedPenalty);
    paid += amount;
    const note = amount < amountDue ? "Partial payment" : amount > amountDue ? "Advance payment" : "Scheduled payment";
    return { date, amount, method, balance: Math.max(0, terms.total + accruedPenalty - paid), note };
  });

  const remainingBeforeToday = Math.max(0, terms.total + accruedPenalty - paid);
  if (today > cursorDate && remainingBeforeToday > 0) {
    accruedPenalty += calculateOverdueInterest(remainingBeforeToday, terms.last, cursorDate, today);
  }

  return { ...loan, terms, history, ...loanPosition(terms, paid, today, accruedPenalty) };
}


export class LedgerError extends Error {}

function borrowerDetails(fields) {
  const name = fields.name.trim();
  const barangay = fields.barangay.trim();
  const contact = fields.contact.trim();
  if (!name || !barangay || !validContact(contact)) {
    throw new LedgerError("Check the borrower’s name, barangay, and contact number.");
  }
  return { name, barangay, contact };
}

function loanDetails(fields) {
  const { principal, interest, count, frequency, start } = fields;
  const terms = calculateTerms({ principal, interest, count, frequency, start });
  if (!terms || terms.error) throw new LedgerError(terms?.error ?? "Check the loan terms and try again.");
  return { principal, interest, count, frequency, start };
}

export function applyLedgerAction(ledger, action) {
  const revision = ledger.revision + 1;
  const target = action.type === "undo" ? ledger.lastAction : action;
  const loanIndex = ledger.loans.findIndex(record => record.id === target?.id);
  let loan = ledger.loans[loanIndex];

  if (action.type === "undo") {
    if (!target || action.revision !== ledger.revision || !loan) {
      throw new LedgerError("The latest action changed. Check the ledger before trying Undo again.");
    }
  } else if (action.type !== "add" && (!loan || action.revision !== loan.revision)) {
    throw new LedgerError("This borrower changed. Close this view and reopen the record to try again.");
  }

  if (loan?.archived && ["edit", "payment", "archive"].includes(action.type)) {
    throw new LedgerError("Restore this borrower before making changes.");
  }

  switch (action.type) {
    case "add":
      loan = {
        ...borrowerDetails(action.fields), ...loanDetails(action.fields),
        id: "TL-" + ledger.nextId, archived: null, payments: [],
      };
      ledger.loans.push(loan);
      ledger.nextId += 1;
      break;
    case "edit":
      Object.assign(loan, borrowerDetails(action.fields), loan.payments.length ? {} : loanDetails(action.fields));
      break;
    case "payment": {
      const record = projectLoan(loan);
      if (!Number.isSafeInteger(action.amount) || action.amount <= 0 || action.amount > record.balance) {
        throw new LedgerError("Enter a payment amount greater than zero and no more than the balance.");
      }
      if (!validDate(action.date)) throw new LedgerError("Enter a valid payment date.");
      if (!validPaymentMethod(action.method)) throw new LedgerError("Select a payment method.");
      loan.payments.push({ date: action.date, amount: action.amount, method: action.method });
      break;
    }
    case "archive":
      loan.archived = TODAY;
      break;
    case "restore":
      if (!loan.archived) throw new LedgerError("This borrower is already active.");
      loan.archived = null;
      break;
    case "delete":
      if (loan.payments.length) throw new LedgerError("Borrowers with recorded payments can be archived.");
      if (action.ledgerRevision !== ledger.revision) {
        throw new LedgerError("The Dashboard totals changed. Close and reopen this confirmation to review the new totals.");
      }
      ledger.loans.splice(loanIndex, 1);
      break;
    case "undo":
      if (target.type === "payment") loan.payments.pop();
      else loan.archived = null;
      break;
    default:
      throw new LedgerError("This action is unavailable.");
  }

  if (action.type !== "delete") loan.revision = revision;
  ledger.revision = revision;
  ledger.lastAction = action.type === "payment" || action.type === "archive"
    ? { type: action.type, id: loan.id }
    : null;
  return ledger;
}
