import {
  TODAY, FREQUENCIES, PAYMENT_METHODS, LedgerError, calculateTerms, dueDate, initialLedger, loanPosition, money,
  parseHundredths, paymentMethodLabel, projectLoan, readableDate, validContact, validDate, validPaymentMethod,
} from "./ledger.mjs";
import { loadLedger, sampleLedgerKey, saveLedger } from "./store.mjs";
import { authenticate, register, usernameError } from "./auth.mjs";
import { analyticsMarkup, analyticsRanges } from "./analytics.mjs";
import { calendarActivity, calendarDateLabel, calendarGrid, shiftCalendarDay, shiftCalendarMonth } from "./calendar.mjs";

const icons = {
  book: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18m3-12h5m-5 4h5m-5 4h3"/>',
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  borrowers: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m1-15a3 3 0 0 1 0 6m5 9v-2a4 4 0 0 0-3-4"/>',
  payments: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-14 5h3"/>',
  analytics: '<path d="M4 4v16h16M8 16v-4m5 4V8m5 8v-6"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8m-9 4h4"/>',
  logout: '<path d="M10 17l5-5-5-5m5 5H3m11-8h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m-13 5h3m2 0h3"/>',
  undo: '<path d="M3 10h11a5 5 0 0 1 0 10h-3M7 6l-4 4 4 4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  hide: '<path d="m3 3 18 18M10 6.2a11 11 0 0 1 2-.2c6.5 0 10 6 10 6a17 17 0 0 1-3 3.5M6.3 7.6A18 18 0 0 0 2 12s3.5 6 10 6a11 11 0 0 0 4.4-.9"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  moon: '<path d="M20.9 14.4A9 9 0 0 1 9.6 3.1 9 9 0 1 0 20.9 14.4Z"/>',
  settings: '<path d="M4 6h2m4 0h10M4 12h9m4 0h3M4 18h4m4 0h8"/><circle cx="8" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',
};

function icon(name) {
  return '<svg aria-hidden="true" focusable="false" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + "</svg>";
}

const $ = (selector, root = document) => root.querySelector(selector);
const themeKey = "talaan-theme";
const sortKey = "talaan-default-borrower-sort";
const sortLabels = { balance: "Balance", due: "Due Date", name: "Name" };
const sortOptions = Object.entries(sortLabels).map(([key, label]) =>
  '<option value="' + key + '">' + label + "</option>"
).join("");
const themeToggles = document.querySelectorAll("[data-theme-toggle]");

function storePreference(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function validSort(value) {
  return Object.hasOwn(sortLabels, value) ? value : "due";
}

function savedSort() {
  try {
    return validSort(localStorage.getItem(sortKey));
  } catch {
    return "due";
  }
}

function applyTheme(theme) {
  const light = theme === "light";
  const selectedTheme = light ? "light" : "dark";
  const label = light ? "Dark mode" : "Light mode";
  document.documentElement.dataset.theme = selectedTheme;
  $('meta[name="theme-color"]').content = light ? "#f0e9fa" : "#1c1633";
  for (const button of themeToggles) {
    button.innerHTML = icon(light ? "moon" : "sun") + '<span class="theme-label">' + label + "</span>";
    button.setAttribute("aria-label", label);
    button.title = label;
  }
  const choice = $("#settings-theme-" + selectedTheme);
  if (choice) choice.checked = true;
}

function chooseTheme(theme) {
  applyTheme(theme);
  return storePreference(themeKey, theme);
}

applyTheme(document.documentElement.dataset.theme);
for (const button of themeToggles) {
  button.addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    chooseTheme(theme);
  });
}
window.addEventListener("storage", event => {
  if (event.key === themeKey) applyTheme(event.newValue);
  if (event.key === sortKey) {
    defaultSort = validSort(event.newValue);
    const select = $("#default-sort");
    if (select) {
      sort = defaultSort;
      select.value = defaultSort;
    }
  }
});

const entry = $("#entry");
const workspace = $("#workspace");
const content = $("#workspace-content");
const title = $("#page-title");
const login = $("#sign-in-form");
const signup = $("#sign-up-form");
const authHeading = $("#sign-in-heading");
const password = $("#password");
const passwordToggle = $("#password-toggle");
const dialog = $("#dialog");
const notice = $("#notice");
const undo = $("#undo");
const pageTitles = { dashboard: "Dashboard", borrowers: "Borrowers", payments: "Payments", calendar: "Calendar", analytics: "Analytics", archive: "Archive", settings: "Settings" };
const tabTitles = { active: "Active", today: "Due Today", overdue: "Overdue", closed: "Closed" };
const updates = typeof BroadcastChannel === "function" ? new BroadcastChannel("talaan-ledger") : null;

let activeAccount;
let authPending = false;
let ledger;
let records = [];
let saving = false;
let page = "dashboard";
let tab = "active";
let search = "";
let selectedBorrower = null;
let scheduleStart = 0;
let defaultSort = savedSort();
let sort = defaultSort;
let paymentFilter = "all";
let analyticsRange = analyticsRanges[0];
let calendarFocus = TODAY;
let calendarSelected = TODAY;
let calendarMode = "dues";
let opener;
let noticeTimer;

function notify(message) {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  noticeTimer = setTimeout(() => { notice.textContent = ""; }, 4500);
}

function setLedger(snapshot) {
  ledger = snapshot;
  records = snapshot.loans.map(loan => projectLoan(loan));
  updateUndo();
}

function updateUndo() {
  undo.setAttribute("aria-disabled", String(saving || !ledger?.lastAction));
}

async function refreshFromStorage() {
  const account = activeAccount;
  if (!account) return;
  const snapshot = await loadLedger(account.key);
  if (activeAccount === account && snapshot.revision > ledger.revision) {
    setLedger(snapshot);
    refreshPage();
  }
}

updates?.addEventListener("message", event => {
  if (event.data === activeAccount?.key || (typeof event.data === "number" && activeAccount?.key === sampleLedgerKey)) {
    refreshFromStorage().catch(() => {});
  }
});

for (const brand of document.querySelectorAll("[data-brand]")) {
  brand.innerHTML = '<div class="brand"><span class="brand-mark">' + icon("book") +
    '</span><div><div class="brand-name">In-Debt-Pendent</div><div class="brand-detail">Loan ledger</div></div></div>';
}
for (const item of document.querySelectorAll("[data-page]")) {
  item.insertAdjacentHTML("afterbegin", icon(item.dataset.page));
}
undo.insertAdjacentHTML("afterbegin", icon("undo"));
undo.title = "Only the latest saved payment or archive can be undone.";
undo.addEventListener("click", () => {
  if (!saving && ledger?.lastAction) {
    persist({ type: "undo", revision: ledger.revision }, "Last action undone.");
  }
});
$("#today").innerHTML = icon("calendar") +
  '<span class="today-text">Current sDate<time datetime="' + TODAY + '">' + readableDate(TODAY) + "</time></span>";

function setPasswordVisible(visible) {
  password.type = visible ? "text" : "password";
  passwordToggle.innerHTML = icon(visible ? "hide" : "eye");
  passwordToggle.setAttribute("aria-pressed", String(visible));
  passwordToggle.setAttribute("aria-label", visible ? "Hide password" : "Show password");
}
setPasswordVisible(false);
passwordToggle.addEventListener("click", () => setPasswordVisible(password.type === "password"));

function setFieldError(form, field, message) {
  const input = form.elements.namedItem(field);
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
  $("#" + input.id + "-error", form).textContent = message;
}

function showAuth(signingUp) {
  login.hidden = signingUp;
  signup.hidden = !signingUp;
  authHeading.textContent = signingUp ? "Create an account" : "Sign in to In-Debt-Pendent";
}

function clearAuthErrors(form) {
  for (const input of form.querySelectorAll("[aria-invalid]")) setFieldError(form, input.name, "");
  $('[role="alert"]', form).textContent = "";
}

entry.addEventListener("click", event => {
  const button = event.target.closest("[data-auth-mode]");
  if (!button || authPending) return;
  password.value = "";
  setPasswordVisible(false);
  signup.reset();
  clearAuthErrors(login);
  clearAuthErrors(signup);
  showAuth(button.dataset.authMode === "sign-up");
  authHeading.focus();
});

for (const form of [login, signup]) {
  form.addEventListener("input", event => {
    if (!event.target.name) return;
    setFieldError(form, event.target.name, "");
    $('[role="alert"]', form).textContent = "";
  });
}

function setAuthBusy(form, busy, label) {
  authPending = busy;
  form.setAttribute("aria-busy", String(busy));
  const submit = $('button[type="submit"]', form);
  submit.disabled = busy;
  submit.textContent = label;
  $("[data-auth-mode]", form).disabled = busy;
}

function openWorkspace(key, snapshot, username) {
  activeAccount = { key, username: username.toLowerCase() };
  sort = defaultSort;
  setLedger(snapshot);
  login.reset();
  signup.reset();
  setPasswordVisible(false);
  showAuth(false);
  entry.hidden = true;
  workspace.hidden = false;
  navigate("dashboard");
}

login.addEventListener("submit", async event => {
  event.preventDefault();
  if (authPending) return;
  const username = login.elements.username.value.trim();
  const secret = password.value;
  setFieldError(login, "username", username ? "" : "Required");
  setFieldError(login, "password", secret ? "" : "Required");
  $("#login-error").textContent = "";
  if (!username || !secret) {
    (username ? password : login.elements.username).focus();
    return;
  }
  setAuthBusy(login, true, "Opening ledger…");
  try {
    const key = await authenticate(username, secret);
    if (key) openWorkspace(key, await loadLedger(key), username);
    else {
      $("#login-error").textContent = "Incorrect username or password";
      password.focus();
    }
  } catch {
    $("#login-error").textContent = "Couldn’t open the In-Dept-Pendent. Check that the server is running, then try again.";
  } finally {
    setAuthBusy(login, false, "Sign in");
  }
});

signup.addEventListener("submit", async event => {
  event.preventDefault();
  if (authPending) return;
  const username = signup.elements.username.value.trim();
  const secret = signup.elements.password.value;
  const confirm = signup.elements.confirm.value;
  const errors = {
    username: usernameError(username),
    password: !secret ? "Required" : secret.length < 8 ? "Use at least 8 characters." : "",
    confirm: !confirm ? "Required" : confirm !== secret ? "Passwords must match." : "",
  };
  clearAuthErrors(signup);
  for (const [field, message] of Object.entries(errors)) setFieldError(signup, field, message);
  const firstError = Object.keys(errors).find(field => errors[field]);
  if (firstError) {
    signup.elements.namedItem(firstError).focus();
    return;
  }

  setAuthBusy(signup, true, "Creating account…");
  try {
    const key = await register(username, secret);
    if (key) {
      openWorkspace(key, initialLedger(false), username);
      notify("Account created.");
    } else {
      setFieldError(signup, "username", "This username is already taken.");
      signup.elements.username.focus();
    }
  } catch {
    $("#signup-error").textContent = "Couldn’t create an account. Check that the server is running, then try again.";
  } finally {
    setAuthBusy(signup, false, "Create an account");
  }
});

function logout() {
  activeAccount = undefined;
  selectedBorrower = null;
  ledger = undefined;
  records = [];
  workspace.hidden = true;
  entry.hidden = false;
  content.replaceChildren();
  tab = "active";
  search = "";
  sort = defaultSort;
  paymentFilter = "all";
  analyticsRange = analyticsRanges[0];
  calendarFocus = TODAY;
  calendarSelected = TODAY;
  calendarMode = "dues";
  notice.textContent = "";
  window.scrollTo(0, 0);
  authHeading.focus();
}

$(".sidebar", workspace).addEventListener("click", event => {
  const item = event.target.closest("[data-page]");
  if (item && item.dataset.page !== page) navigate(item.dataset.page);
});

function table(headers, rows, label, extraClass = "") {
  return '<div class="table-scroll" role="region" aria-label="' + label + '" tabindex="0"><table class="' + extraClass + '">' +
    "<thead><tr>" + headers.map(header => {
      const [text, classes = ""] = Array.isArray(header) ? header : [header];
      return '<th scope="col" class="' + classes + '">' + text + "</th>";
    }).join("") + "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>";
}

function cell(value, classes = "") {
  return '<td class="' + classes + '">' + value + "</td>";
}

function row(cells) {
  return "<tr>" + cells.join("") + "</tr>";
}

function escapeHtml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value).replace(/[&<>"']/g, character => entities[character]);
}

function status(value) {
  return '<span class="status status-' + value.toLowerCase() + '">' + value + "</span>";
}

function action(label, name, record, classes = "small-action", disabled = false) {
  return '<button type="button" class="' + classes + '" data-action="' + name +
    '" data-id="' + record.id + '" aria-label="' + label + ' for ' + escapeHtml(record.name) + '"' +
    (disabled ? " disabled" : "") + ">" + label + "</button>";
}

function empty(message) {
  return '<p class="empty" role="status">' + message + "</p>";
}

function ledgerTotals() {
  return records.reduce((totals, record) => {
    totals.lent += record.principal;
    totals.collected += record.paid;
    totals.balance += record.balance;
    return totals;
  }, { lent: 0, collected: 0, balance: 0 });
}

function showDashboard() {
  const activeRecords = records.filter(record => !record.archived);
  const dueToday = activeRecords.filter(record => record.dueToday);
  const overdue = activeRecords.filter(record => record.overdue).sort((a, b) => b.overdue - a.overdue);
  const totals = ledgerTotals();
  const collectible = activeRecords.reduce((sum, record) => sum + record.amountDue, 0);
  const figures = [["Total lent", money(totals.lent)], ["Total collected", money(totals.collected)], ["Outstanding balance", money(totals.balance)], ["Overdue accounts", overdue.length]];
  content.innerHTML = `
    <div class="collection-desk">
      <div class="desk-main">
        <header class="desk-lead"><span>Due for collection</span><strong>${money(collectible)}</strong>
          <p>${dueToday.length} accounts due today · ${overdue.length} overdue</p></header>
        ${collection("overdue", overdue)}${collection("today", dueToday)}
      </div>
      <aside class="desk-totals"><h2>Ledger balance</h2><dl>${figures.map(([label,value]) => '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>').join("")}</dl></aside>
    </div>`;
}

function collection(key, accounts) {
  const late = key === "overdue";
  const label = tabTitles[key];
  const columns = [
    ["Name", "col-name"],
    ["Amount Due Now", "numeric"],
    ['<span class="sr-only">Action</span>', "col-action"],
  ];
  const rows = accounts.slice(0, 5).map(record => row([
    cell(escapeHtml(record.name) + (!late ? '<span class="collection-detail">' + escapeHtml(record.contact) + "</span>" : ""), "name identity-cell"),
    cell(money(record.amountDue) + (late ? '<span class="collection-detail">Balance ' +
      money(record.balance) + "</span>" : ""), "numeric emphasis" + (late ? " amount-overdue" : "")),
    cell(action("Record Payment", "payment", record, "button outline compact"), "row-action-cell"),
  ]));
  return '<section class="collection table-panel ' + key + '" aria-labelledby="collection-' + key +
    '"><div class="panel-heading"><div class="panel-title">' + icon(late ? "clock" : "calendar") +
    '<h2 id="collection-' + key + '">' + label + '</h2></div><a class="view-all" href="#borrowers-' + key +
    '" data-view="' + key + '" aria-label="View all ' + label + ' borrowers">View all</a></div>' +
    (rows.length ? table(columns, rows, label + " accounts") : empty(late ? "No overdue accounts." : "No accounts due today.")) +
    "</section>";
}

const sorts = {
  balance: (a, b) => b.balance - a.balance,
  due: (a, b) => (a.nextDue ?? "9999-99-99").localeCompare(b.nextDue ?? "9999-99-99"),
  name: (a, b) => a.name.localeCompare(b.name),
};

function showBorrowers() {
  content.innerHTML =
    '<div class="toolbar"><div class="field"><label for="search">Search borrowers</label><div class="search-field">' +
    icon("search") + '<input type="search" id="search" placeholder="Search by name or ID"></div></div>' +
    '<div class="field sort-field"><label for="sort">Sort by</label><select id="sort">' + sortOptions + '</select></div>' +
    '<button class="button primary add" type="button" data-action="add">' + icon("plus") + "Add Borrower</button></div>" +
    '<div class="table-panel"><div class="tabs" role="tablist" aria-label="Borrower filters">' +
    Object.entries(tabTitles).map(([key, label]) =>
      '<button type="button" role="tab" id="borrowers-' + key + '" data-tab="' + key +
      '" aria-controls="borrower-results">' + label + "</button>"
    ).join("") + '</div><div id="borrower-results" role="tabpanel"></div></div>';

  const searchInput = $("#search");
  const sortInput = $("#sort");
  searchInput.value = search;
  sortInput.value = sort;
  searchInput.addEventListener("input", () => { search = searchInput.value; refreshBorrowers(); });
  sortInput.addEventListener("change", () => { sort = sortInput.value; refreshBorrowers(); });
  $(".tabs").addEventListener("keydown", event => {
    const keys = Object.keys(tabTitles);
    const index = keys.indexOf(tab);
    const nextIndex = { ArrowLeft: (index + keys.length - 1) % keys.length, ArrowRight: (index + 1) % keys.length, Home: 0, End: keys.length - 1 }[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    changeTab(keys[nextIndex]);
    $("#borrowers-" + tab).focus();
  });
  changeTab(tab);
}

function changeTab(key) {
  tab = key;
  for (const button of content.querySelectorAll("[data-tab]")) {
    const selected = button.dataset.tab === tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  $("#borrower-results").setAttribute("aria-labelledby", "borrowers-" + tab);
  refreshBorrowers();
}

function refreshBorrowers() {
  const filters = {
    active: record => record.balance > 0,
    today: record => record.dueToday,
    overdue: record => record.overdue > 0,
    closed: record => record.balance === 0,
  };
  const query = search.trim().toLowerCase();
  const matches = records.filter(record => !record.archived && filters[tab](record))
    .filter(record => record.name.toLowerCase().includes(query) || record.id.toLowerCase().includes(query))
    .sort((a, b) => sorts[sort](a, b) || sorts.name(a, b));
  const record = matches.find(item => item.id === selectedBorrower) ?? matches[0];
  if (!record) {
    $("#borrower-results").innerHTML = empty("No borrower records match.");
    return;
  }
  if (record.id !== selectedBorrower) {
    selectedBorrower = record.id;
    scheduleStart = Math.floor(Math.min(record.covered, record.count - 1) / 5) * 5;
  }
  const options = matches.map(item => `<button type="button" id="pick-${item.id}" data-borrower="${item.id}" aria-current="${item.id === record.id}" aria-controls="file-pane">
    <span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.barangay)} · ${item.id}</small>
  </button>`).join("");
  $("#borrower-results").innerHTML = `<div class="borrower-spread">
    <section class="borrower-index" aria-label="Borrower list"><div class="index-count">${matches.length} ${matches.length === 1 ? "borrower" : "borrowers"}</div>
    <div class="index-scroll">${options}</div></section>
    <div id="file-pane">${borrowerFile(record)}</div></div>`;
}

function borrowerFile(record) {
  const terms = record.terms;
  const start = Math.min(scheduleStart, terms.count - 1);
  const end = Math.min(start + 5, terms.count);
  const installments = [];
  for (let i = start; i < end; i++) {
    const amount = i + 1 === terms.count ? terms.final : terms.regular;
    const remaining = amount - Math.min(amount, Math.max(0, record.paid - i * terms.regular));
    const date = dueDate(terms.start, terms.frequency, i);
    const state = remaining === 0 ? "Paid" : remaining < amount ? "Part paid" : date < TODAY ? "Overdue" : date === TODAY ? "Due today" : "Upcoming";
    installments.push(row([cell(readableDate(date)), cell(state), cell(money(amount), "numeric"), cell(money(remaining), "numeric emphasis")]));
  }
  const facts = [
    ["Amount borrowed", money(record.principal)],
    ["Total payable", money(record.effectiveTotal ?? terms.total)],
    ["Amount due now", money(record.amountDue)],
    ["Next due", readableDate(record.nextDue)],
    ["Payment per period", money(terms.regular)],
    ["Frequency", FREQUENCIES[record.frequency]],
  ];
  if (record.overdueInterest > 0) {
    facts.splice(2, 0, [
      `Overdue interest (${record.postMaturityDays} ${record.postMaturityDays === 1 ? "day" : "days"} @ 1%/day)`,
      `+${money(record.overdueInterest)}`,
    ]);
  }
  const history = [...record.history].reverse().map(payment => row([
    cell(readableDate(payment.date)), cell(paymentMethodLabel(payment.method)), cell(money(payment.amount), "numeric"), cell(money(payment.balance), "numeric"),
  ]));
  return `
    <article class="borrower-file" aria-labelledby="file-name">
      <header class="file-header">
        <div class="file-meta"><span>${escapeHtml(record.id)}</span>${status(record.status)}${record.overdue ? `<span>${record.overdue} ${record.overdue === 1 ? "day" : "days"} overdue</span>` : ""}</div>
        <h2 id="file-name" tabindex="-1">${escapeHtml(record.name)}</h2>
        <p>${escapeHtml(record.barangay)} · ${escapeHtml(record.contact)}</p>
      </header>
      <div class="file-balance"><div><span>Outstanding balance</span><strong>${money(record.balance)}</strong></div>
        ${action("Record Payment", "payment", record, "button primary", record.balance === 0)}</div>
      <dl class="file-facts">${facts.map(([label,value]) => '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>').join("")}</dl>
      <section class="file-section"><h3>Repayment schedule</h3>
        ${table(["Due date","Status",["Installment","numeric"],["Remaining","numeric"]], installments, "Repayment schedule")}
        <div class="schedule-nav"><span>Installments ${start + 1}–${end} of ${terms.count}</span>
        ${start ? '<button id="earlier-dues" data-step="-5" class="small-action">Earlier</button>' : ""}
        ${end < terms.count ? '<button id="later-dues" data-step="5" class="small-action">Later</button>' : ""}</div></section>
      <section class="file-section"><h3>Payment history</h3>${history.length ? table(["Date","Method",["Paid","numeric"],["Balance after","numeric"]], history,"Borrower payment history") : empty("No payments recorded.")}</section>
      <footer class="file-actions">${action("Edit", "edit", record)}${action("Archive", "archive", record)}${deleteButton(record)}</footer>
    </article>`;
}

function showPayments() {
  if (paymentFilter !== "all" && !records.some(record => record.id === paymentFilter)) paymentFilter = "all";
  content.innerHTML = '<div class="toolbar"><div class="field"><label for="payment-filter">Borrower</label>' +
    '<select id="payment-filter"><option value="all">All borrowers</option>' +
    [...records].sort(sorts.name).map(record => '<option value="' + record.id + '">' + escapeHtml(record.name) +
      (record.archived ? " (archived)" : "") + "</option>").join("") +
    '</select></div></div><div class="table-panel" id="payment-results"></div>';
  const select = $("#payment-filter");
  select.value = paymentFilter;
  select.addEventListener("change", () => {
    paymentFilter = select.value;
    refreshPayments();
  });
  refreshPayments();
}

function refreshPayments() {
  const items = records.filter(record => paymentFilter === "all" || record.id === paymentFilter)
    .flatMap(record => record.history.map(payment => ({ ...payment, borrower: record.name })))
    .sort((a, b) => b.date.localeCompare(a.date) || a.borrower.localeCompare(b.borrower));
  const rows = items.map(payment => row([
    cell(readableDate(payment.date)), cell(escapeHtml(payment.borrower), "name identity-cell"), cell(money(payment.amount), "numeric emphasis"),
    cell(paymentMethodLabel(payment.method)),
    cell(money(payment.balance), "numeric"), cell(payment.note, "muted-cell"),
  ]));
  $("#payment-results").innerHTML = rows.length ? table(
    ["Date", "Borrower", ["Amount Paid", "numeric"], "Payment Method", ["Balance After", "numeric"], "Note"], rows, "Recorded payments"
  ) : empty("No payments recorded for this borrower.");
}

function showArchive() {
  const rows = records.filter(record => record.archived).map(record => row([
    cell(escapeHtml(record.name), "name identity-cell"), cell(escapeHtml(record.barangay), "identity-cell"), cell(escapeHtml(record.contact)), cell(money(record.principal), "numeric"),
    cell(money(record.balance), "numeric emphasis"), cell(readableDate(record.archived)),
    cell('<div class="archive-buttons">' + action("View History", "history", record) +
      action("Restore", "restore", record, "button outline compact") + deleteButton(record) + "</div>"),
  ]));
  content.innerHTML = '<div class="table-panel">' + (rows.length ? table(
    ["Name", "Barangay", "Contact Number", ["Amount Borrowed", "numeric"], ["Balance", "numeric"], "Date Archived", ["Actions", "row-action-cell"]],
    rows, "Archived records"
  ) : empty("No archived records.")) + "</div>";
}

function showSettings() {
  const themeChoices = [["dark", "Midnight Violet"], ["light", "Light mode"]].map(([theme, label]) =>
    '<label class="theme-choice"><span class="theme-sample" data-palette="' + theme + '" aria-hidden="true"><span></span></span>' +
    '<span class="theme-choice-label"><input type="radio" name="settings-theme" id="settings-theme-' + theme + '" value="' + theme +
    '"' + (document.documentElement.dataset.theme === theme ? ' checked' : '') + '> ' + label + "</span></label>"
  ).join("");

  content.innerHTML = '<div class="settings-panel table-panel">' +
    '<section class="settings-section" aria-labelledby="settings-appearance"><h2 id="settings-appearance">Appearance</h2>' +
    '<fieldset class="theme-choices"><legend class="sr-only">Color theme</legend>' + themeChoices + '</fieldset></section>' +
    '<section class="settings-section" aria-labelledby="settings-borrowers"><h2 id="settings-borrowers">Borrowers</h2>' +
    '<div class="field settings-sort"><label for="default-sort">Default sort</label><select id="default-sort" aria-describedby="sort-help">' +
    sortOptions + '</select><p id="sort-help" class="settings-help">Sets the starting order for the borrower list in this browser.</p></div></section>' +
    '<section class="settings-section" aria-labelledby="settings-account"><h2 id="settings-account">Account</h2>' +
    '<div class="settings-account"><dl><dt>Username</dt><dd>' + escapeHtml(activeAccount.username) + '</dd></dl>' +
    '<button type="button" id="settings-logout" class="button outline" aria-label="Log out account" aria-haspopup="dialog">' +
    icon("logout") + 'Log out</button></div></section></div>';

  const appearance = $(".theme-choices", content);
  appearance.addEventListener("change", event => {
    if (!chooseTheme(event.target.value)) notify("Theme applied for this visit.");
  });

  const defaultSelect = $("#default-sort", content);
  defaultSelect.value = defaultSort;
  defaultSelect.addEventListener("change", () => {
    defaultSort = validSort(defaultSelect.value);
    sort = defaultSort;
    const saved = storePreference(sortKey, defaultSort);
    notify(saved ? "Default sort saved." : "Default sort applied for this visit.");
  });

  $("#settings-logout", content).addEventListener("click", confirmLogout);
}

function calendarAgenda(entries) {
  const payments = calendarMode === "payments";
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const label = payments ? "Total recorded" : "Total due";
  const dayStatus = calendarSelected < TODAY ? "Overdue" : calendarSelected === TODAY ? "Due today" : "Upcoming";
  const installmentStatus = dayStatus === "Overdue" ? status(dayStatus) : '<span class="status">' + dayStatus + "</span>";
  const items = entries.map(({ record, amount, method }) => `
    <li class="calendar-agenda-entry">
      <div class="calendar-agenda-line">
        <span class="calendar-entry-name">${escapeHtml(record.name)}</span>
        <strong>${money(amount)}</strong>
      </div>
      ${payments ? `<span class="calendar-payment-method">${paymentMethodLabel(method)}</span>` : `<div class="calendar-agenda-line">
        ${installmentStatus}
        ${action("Record Payment", "payment", record, "button outline compact")}
      </div>`}
    </li>
  `).join("");

  return `
    <section class="table-panel calendar-panel" aria-labelledby="calendar-agenda-heading">
      <header class="calendar-agenda-heading">
        <h2 id="calendar-agenda-heading" tabindex="-1">${calendarDateLabel(calendarSelected)}</h2>
        <dl class="calendar-agenda-line calendar-total"><dt>${label}</dt><dd>${money(total)}</dd></dl>
      </header>
      ${items ? `<ul class="calendar-agenda-list">${items}</ul>` : empty(
        payments ? "No payments recorded for this date." : "No unpaid installments scheduled for this date."
      )}
    </section>
  `;
}

function showCalendar() {
  const events = calendarActivity(records, calendarFocus, calendarMode);
  const agendaEvents = calendarFocus.slice(0, 7) === calendarSelected.slice(0, 7)
    ? events : calendarActivity(records, calendarSelected, calendarMode);
  const agenda = [...(agendaEvents.get(calendarSelected) ?? [])].sort((a, b) => sorts.name(a.record, b.record));

  content.innerHTML = `
    <div class="calendar-layout">
      <section class="table-panel calendar-panel" aria-labelledby="calendar-month-heading">
        <div class="field calendar-filter">
          <label for="calendar-mode">Show</label>
          <select id="calendar-mode">
            <option value="dues"${calendarMode === "dues" ? " selected" : ""}>Scheduled dues</option>
            <option value="payments"${calendarMode === "payments" ? " selected" : ""}>Recorded payments</option>
          </select>
        </div>
        ${calendarGrid(calendarFocus, calendarSelected, events, calendarMode)}
      </section>
      ${calendarAgenda(agenda)}
    </div>
  `;

  $("#calendar-mode", content).addEventListener("change", event => {
    calendarMode = event.target.value;
    refreshPage();
  });
  for (const [id, step] of [["prev", -1], ["next", 1], ["today", 0]]) {
    $("#calendar-" + id, content).addEventListener("click", () => {
      calendarFocus = step ? shiftCalendarMonth(calendarFocus, step) : TODAY;
      calendarSelected = calendarFocus;
      refreshPage();
    });
  }

  const grid = $(".calendar-grid", content);
  function focusDay(date, select = false) {
    calendarFocus = date;
    if (select) calendarSelected = date;
    showCalendar();
    $("#calendar-day-" + date, content).focus({ preventScroll: true });
  }

  grid.addEventListener("click", event => {
    const day = event.target.closest("[data-calendar-date]");
    if (day) focusDay(day.dataset.calendarDate, true);
  });
  grid.addEventListener("keydown", event => {
    const day = event.target.closest("[data-calendar-date]");
    if (!day || event.altKey || event.ctrlKey || event.metaKey) return;
    const days = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const months = { PageUp: -1, PageDown: 1 };
    const date = day.dataset.calendarDate;
    let target;
    if (Object.hasOwn(days, event.key)) target = shiftCalendarDay(date, days[event.key]);
    else if (Object.hasOwn(months, event.key)) target = shiftCalendarMonth(date, months[event.key]);
    if (target) {
      event.preventDefault();
      focusDay(target);
    }
  });
}

function showAnalytics() {
  const figuresOpen = $("#analytics-figures", content)?.open ?? false;
  content.innerHTML = analyticsMarkup(records, analyticsRange, figuresOpen);
  const range = $("#analytics-range", content);
  range.addEventListener("change", () => {
    analyticsRange = Number(range.value);
    refreshPage();
  });
}

const pages = {
  dashboard: showDashboard,
  borrowers: showBorrowers,
  payments: showPayments,
  calendar: showCalendar,
  analytics: showAnalytics,
  archive: showArchive,
  settings: showSettings,
};

function restoreFocus(control) {
  if (control?.isConnected && !control.disabled) {
    control.focus({ preventScroll: true });
    return;
  }
  const replacement = control?.id
    ? $("#" + CSS.escape(control.id), content)
    : [...content.querySelectorAll("[data-action]")].find(button =>
      !button.disabled && button.dataset.action === control?.dataset.action && button.dataset.id === control?.dataset.id
    );
  (replacement ?? $("#search", content) ?? $("#calendar-agenda-heading", content) ?? title).focus({ preventScroll: true });
}

function refreshPage() {
  if (page === "settings") return;
  const focus = content.contains(document.activeElement) ? document.activeElement : null;
  const offset = $(".table-scroll", content)?.scrollLeft ?? 0;
  if (page === "borrowers") {
    $("#search", content).value = search;
    changeTab(tab);
  } else {
    pages[page]();
  }
  const scroll = $(".table-scroll", content);
  if (scroll) scroll.scrollLeft = offset;
  if (focus && !focus.isConnected) restoreFocus(focus);
}

function navigate(nextPage) {
  page = nextPage;
  title.textContent = pageTitles[page];
  for (const item of document.querySelectorAll("[data-page]")) {
    if (item.dataset.page === page) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }
  pages[page]();
  window.scrollTo(0, 0);
  title.focus({ preventScroll: true });
}

function formField(id, label, control) {
  return '<div class="field"><label for="' + id + '">' + label + "</label>" + control +
    '<p class="field-error" id="' + id + '-error"></p></div>';
}

const cancelButton = '<button class="button outline" type="button" data-dismiss>Cancel</button>';

function openDialog(name, body, footer, options = {}) {
  opener = options.opener ?? document.activeElement;
  dialog.classList.toggle("wide", Boolean(options.wide));
  const error = options.form ? '<p class="field-error save-error" role="alert"></p>' : "";
  const markup = '<div class="dialog-head"><h2 id="dialog-title">' + name +
    '</h2><button class="icon-button" type="button" data-dismiss aria-label="Close dialog">' + icon("close") +
    '</button></div><div class="dialog-body">' + body + error + '</div><div class="dialog-footer">' + footer + "</div>";
  dialog.innerHTML = options.form ? "<form novalidate>" + markup + "</form>" : markup;
  dialog.showModal();
  const focus = $("input:not(:disabled), select:not(:disabled)", dialog) ?? $(".dialog-footer button", dialog);
  focus?.focus();
  return $("form", dialog);
}

function confirmLogout(event) {
  openDialog(
    "Log out of In-Debt-Pendent?",
    "<p>You’ll return to the sign-in page.</p>",
    cancelButton + '<button class="button primary" type="button" id="confirm-logout">Log out</button>',
    { opener: event.currentTarget },
  );
  $("#confirm-logout", dialog).addEventListener("click", () => {
    dialog.close();
    logout();
  });
}

dialog.addEventListener("click", event => {
  if ($('form[aria-busy="true"]', dialog)) return;
  if (event.target.closest("[data-dismiss]")) dialog.close();
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }
});
dialog.addEventListener("cancel", event => {
  if ($('form[aria-busy="true"]', dialog)) event.preventDefault();
});
dialog.addEventListener("close", () => {
  if (!workspace.hidden) restoreFocus(opener);
});

async function persist(action, message, form) {
  const account = activeAccount;
  if (saving || !account) return;
  saving = true;
  updateUndo();
  const submit = form && $('button[type="submit"]', form);
  const label = submit?.textContent;
  const errorBox = form && $(".save-error", form);
  const controls = form ? [...form.querySelectorAll('button[type="submit"], button[data-dismiss]')] : [];
  if (form) {
    errorBox.textContent = "";
    form.setAttribute("aria-busy", "true");
    controls.forEach(button => { button.disabled = true; });
    submit.textContent = "Saving…";
  }

  try {
    const snapshot = await saveLedger(account.key, action);
    updates?.postMessage(account.key);
    if (activeAccount === account) {
      if (snapshot.revision >= ledger.revision) setLedger(snapshot);
      if (action.type === "add") {
        selectedBorrower = snapshot.loans.at(-1).id;
        scheduleStart = 0;
        search = "";
        tab = "active";
      }
      refreshPage();
      if (form && dialog.open) dialog.close();
      notify(message);
    }
  } catch (error) {
    if (activeAccount !== account) return;
    const message = error instanceof LedgerError
      ? error.message
      : "Couldn’t save in this browser. Check that site data is allowed, then try again.";
    if (errorBox) errorBox.textContent = message;
    else notify(message);
    if (error instanceof LedgerError) await refreshFromStorage().catch(() => {});
  } finally {
    if (form) {
      form.removeAttribute("aria-busy");
      controls.forEach(button => { button.disabled = false; });
      submit.textContent = label;
    }
    saving = false;
    updateUndo();
  }
}

function borrowerEditor(record) {
  const lock = Boolean(record?.history.length);
  const fields = [
    ["name", "Name", "text", record?.name ?? "", 'placeholder="e.g. Mara Dizon"'],
    ["barangay", "Barangay", "text", record?.barangay ?? "", 'placeholder="e.g. San Isidro"'],
    ["contact", "Contact Number", "tel", record?.contact ?? "", 'placeholder="e.g. 09XX XXX XXXX"'],
    ["principal", "Amount Borrowed (₱)", "text", record ? String(record.principal / 100) : "", 'inputmode="decimal" placeholder="0.00"'],
    ["interest", "Interest Rate (%)", "text", record ? String(record.interest / 100) : "", 'inputmode="decimal" placeholder="0"'],
    ["count", "Number of Payments", "text", record?.count ?? "", 'inputmode="numeric" placeholder="1"'],
    ["frequency", "Payment Frequency", "select", record?.frequency ?? "", ""],
    ["start", "Start Date", "date", record?.start ?? "", ""],
  ];
  const body = '<div class="form-grid">' + fields.map(([id, label, type, value, props], index) => {
    const attributes = ' id="' + id + '" name="' + id + '" aria-describedby="' + id + '-error" required' +
      (lock && index >= 3 ? " disabled" : "");
    const control = type === "select"
      ? "<select" + attributes + '><option value="" disabled' + (!value ? " selected" : "") + ">Select frequency</option>" +
        Object.entries(FREQUENCIES).map(([key, text]) => '<option value="' + key + '"' +
          (key === value ? " selected" : "") + ">" + text + "</option>").join("") + "</select>"
      : '<input type="' + type + '"' + attributes + ' value="' + escapeHtml(value) + '" ' + props + ">";
    return formField(id, label, control);
  }).join("") + "</div>" +
    (lock ? '<p class="form-note">This loan has a payment on record. You can still edit the borrower’s details.</p>' : "") +
    '<div class="computed" role="status" aria-live="polite"><h3>Computed automatically</h3><dl><div><dt>Total Payable</dt><dd id="preview-total"></dd></div>' +
    '<div><dt>Payment per Period</dt><dd id="preview-period"></dd></div><div><dt>Last Due Date</dt><dd id="preview-last"></dd></div></dl></div>';
  const form = openDialog(record ? "Edit Borrower" : "Add Borrower", body, cancelButton +
    '<button class="button primary" type="submit">Save</button>', { form: true, wide: true });
  let submitted = false;

  function refresh(validate) {
    const data = Object.fromEntries(fields.map(([id]) => [id, form.elements.namedItem(id).value.trim()]));
    const principal = parseHundredths(data.principal);
    const interest = parseHundredths(data.interest);
    const count = /^\d+$/.test(data.count) ? Number(data.count) : NaN;
    const terms = calculateTerms({ principal, interest, count, frequency: data.frequency, start: data.start });
    const errors = Object.fromEntries(Object.entries(data).map(([id, value]) => [id, value ? "" : "Required"]));
    if (data.contact && !validContact(data.contact)) errors.contact = "Enter a valid phone number.";
    if (data.principal && !(principal > 0)) errors.principal = "Enter a positive amount with up to two decimal places.";
    if (data.interest && interest === null) errors.interest = "Enter zero or a positive rate with up to two decimal places.";
    if (data.count && (!Number.isSafeInteger(count) || count < 1)) errors.count = "Enter a whole number of at least 1.";
    if (data.start && !validDate(data.start)) errors.start = "Enter a valid start date.";
    if (terms?.error) {
      errors[terms.error.startsWith("Reduce") ? "count" : "principal"] = terms.error;
    }
    const preview = terms && !terms.error ? terms : null;
    $("#preview-total", form).textContent = preview ? money(preview.total) : "—";
    $("#preview-period", form).textContent = preview ? money(preview.regular) : "—";
    $("#preview-last", form).textContent = readableDate(preview?.last);
    if (validate) Object.entries(errors).forEach(([id, message]) => setFieldError(form, id, message));
    return { error: Object.keys(errors).find(id => errors[id]), fields: { ...data, principal, interest, count } };
  }

  form.addEventListener("input", () => refresh(submitted));
  form.addEventListener("change", () => refresh(submitted));
  form.addEventListener("submit", event => {
    event.preventDefault();
    submitted = true;
    const { error, fields } = refresh(true);
    if (error) form.elements.namedItem(error).focus();
    else if (record) persist({ type: "edit", id: record.id, revision: record.revision, fields }, "Borrower details saved.", form);
    else persist({ type: "add", fields }, "Borrower added.", form);
  });
  refresh(false);
}

function paymentDialog(record) {
  const methodOptions = Object.entries(PAYMENT_METHODS).map(([method, label]) =>
    '<option value="' + method + '">' + label + "</option>"
  ).join("");
  const body = '<p class="emphasis record-name">' + escapeHtml(record.name) + '</p><dl class="payment-overview">' +
    [["Balance", record.balance], ["Payment per Period", record.terms.regular], ["Amount Due Now", record.amountDue]]
      .map(([label, value]) => "<div><dt>" + label + "</dt><dd>" + money(value) + "</dd></div>").join("") +
    '</dl><div class="form-grid">' +
    formField("amount", "Amount Paid (₱)", '<input name="amount" id="amount" inputmode="decimal" placeholder="0.00" aria-describedby="amount-error payment-help" required>') +
    formField("payment-date", "Payment Date", '<input name="payment-date" id="payment-date" type="date" value="' + TODAY +
      '" aria-describedby="payment-date-error" required>') +
    '<div class="payment-method-field">' + formField("payment-method", "Payment Method",
      '<select name="payment-method" id="payment-method" aria-describedby="payment-method-error" required>' +
      '<option value="">Select a payment method</option>' + methodOptions + "</select>") + "</div>" +
    '</div><p id="payment-help" class="payment-help" aria-live="polite"></p>';
  const form = openDialog("Record Payment", body, cancelButton +
    '<button class="button primary" type="submit">Save Payment</button>', { form: true });
  let submitted = false;

  function refresh(validate) {
    const raw = form.elements.amount.value.trim();
    const amount = parseHundredths(raw);
    const date = form.elements.namedItem("payment-date").value;
    const method = form.elements.namedItem("payment-method").value;
    let amountError = "";
    if (!raw) amountError = "Required";
    else if (!(amount > 0)) amountError = "Enter an amount greater than zero with up to two decimal places.";
    else if (amount > record.balance) amountError = "Amount cannot be more than the balance.";
    const dateError = !date ? "Required" : !validDate(date) ? "Enter a valid payment date." : "";
    const methodError = validPaymentMethod(method) ? "" : "Select a payment method.";
    let helper = "Enter an amount to preview the next due date.";
    if (!amountError) {
      const position = loanPosition(record.terms, record.paid + amount);
      const installments = position.covered - record.covered;
      helper = "Covers " + installments + (installments === 1 ? " installment. " : " installments. ") +
        (position.nextDue ? "Next due " + readableDate(position.nextDue) + "." : "The loan would be paid in full.");
    }
    $("#payment-help", form).textContent = helper;
    const errors = { amount: amountError, "payment-date": dateError, "payment-method": methodError };
    if (validate) Object.entries(errors).forEach(([field, message]) => setFieldError(form, field, message));
    return { error: Object.keys(errors).find(field => errors[field]), amount, date, method };
  }

  form.addEventListener("input", () => refresh(submitted));
  form.addEventListener("submit", event => {
    event.preventDefault();
    submitted = true;
    const { error, amount, date, method } = refresh(true);
    if (error) form.elements.namedItem(error).focus();
    else persist({ type: "payment", id: record.id, revision: record.revision, amount, date, method }, "Payment recorded.", form);
  });
  refresh(false);
}

function historyDialog(record) {
  const rows = [...record.history].reverse().map(payment => row([
    cell(readableDate(payment.date)), cell(money(payment.amount), "numeric"),
    cell(paymentMethodLabel(payment.method)), cell(money(payment.balance), "numeric"),
  ]));
  openDialog("Borrower History", '<p class="emphasis record-name">' + escapeHtml(record.name) +
    '</p><div class="history-overview"><span>Balance <strong>' + money(record.balance) + "</strong></span>" +
    status(record.status) + (record.archived ? status("Archived") : "") + "</div>" +
    (rows.length ? '<div class="table-panel">' + table(
      ["Date", ["Amount Paid", "numeric"], "Payment Method", ["Balance After", "numeric"]], rows, "Borrower payment history"
    ) + "</div>" : empty("No payments recorded.")),
  '<button class="button outline" type="button" data-dismiss>Close</button>');
}

function archiveDialog(record) {
  const form = openDialog("Archive Borrower", '<p class="emphasis record-name">' + escapeHtml(record.name) +
    "</p><p>Archive this borrower record? You can restore it later.</p>" +
    (record.balance > 0 ? '<p class="record-warning">This borrower still has an unpaid balance of ' +
      money(record.balance) + ".</p>" : ""), cancelButton +
    '<button class="button destructive" type="submit">Archive</button>', { form: true });
  form.addEventListener("submit", event => {
    event.preventDefault();
    persist({ type: "archive", id: record.id, revision: record.revision }, "Borrower archived.", form);
  });
}

function deleteButton(record) {
  return record.history.length === 0 ? action("Delete", "delete", record, "small-action delete-action") : "";
}

function deleteDialog(record) {
  const ledgerRevision = ledger.revision;
  const totals = ledgerTotals();
  const impact = [
    ["Total Lent", totals.lent, totals.lent - record.principal],
    ["Total Balance", totals.balance, totals.balance - record.balance],
  ].map(([label, before, after]) =>
    '<div class="delete-total"><h4>' + label + '</h4><dl><div><dt>Before</dt><dd>' + money(before) +
    '</dd></div><div><dt>After</dt><dd>' + money(after) + "</dd></div></dl></div>"
  ).join("");
  const form = openDialog("Delete Borrower", '<p class="emphasis record-name">' + escapeHtml(record.name) +
    '</p><p class="record-warning">This permanently deletes the borrower from the ledger. Review the totals below before you continue.</p>' +
    '<section class="delete-impact" aria-labelledby="delete-impact-title"><h3 id="delete-impact-title">Dashboard totals</h3>' +
    '<div class="delete-totals">' + impact + "</div></section>", cancelButton +
    '<button class="button destructive" type="submit">Delete</button>', { form: true });
  form.addEventListener("submit", event => {
    event.preventDefault();
    persist({ type: "delete", id: record.id, revision: record.revision, ledgerRevision }, "Borrower deleted. Dashboard totals updated.", form);
  });
}

const commands = {
  add: () => borrowerEditor(),
  edit: borrowerEditor,
  payment: paymentDialog,
  history: historyDialog,
  archive: archiveDialog,
  restore: record => persist({ type: "restore", id: record.id, revision: record.revision }, "Borrower restored."),
  delete: deleteDialog,
};

content.addEventListener("click", event => {
  const pick = event.target.closest("[data-borrower]");
  if (pick) {
    const record = records.find(item => item.id === pick.dataset.borrower);
    selectedBorrower = record.id;
    scheduleStart = Math.floor(Math.min(record.covered, record.count - 1) / 5) * 5;
    refreshBorrowers();
    $("#file-name").focus();
    return;
  }
  const step = event.target.closest("[data-step]");
  if (step) {
    scheduleStart = Math.max(0, scheduleStart + Number(step.dataset.step));
    refreshBorrowers();
    (document.getElementById(step.id) ?? $(".schedule-nav button")).focus();
    return;
  }
  const view = event.target.closest("[data-view]");
  if (view) {
    event.preventDefault();
    tab = view.dataset.view;
    search = "";
    navigate("borrowers");
    return;
  }
  const tabButton = event.target.closest("[data-tab]");
  if (tabButton) {
    changeTab(tabButton.dataset.tab);
    return;
  }
  const button = event.target.closest("[data-action]");
  if (button && !button.disabled) {
    commands[button.dataset.action](records.find(record => record.id === button.dataset.id));
  }
});
