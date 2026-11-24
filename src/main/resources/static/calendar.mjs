import { DEMO_TODAY, dueDate } from "./ledger.mjs";

const monthFormat = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "full", timeZone: "UTC" });
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function utcDate(date) {
  return new Date(date + "T00:00:00Z");
}

function isoWithinCalendar(date, fallback) {
  const year = date.getUTCFullYear();
  return year >= 1 && year <= 9999 ? date.toISOString().slice(0, 10) : fallback;
}

export function shiftCalendarDay(date, days) {
  const next = utcDate(date);
  next.setUTCDate(next.getUTCDate() + days);
  return isoWithinCalendar(next, date);
}

export function shiftCalendarMonth(date, months) {
  const next = utcDate(date);
  const day = next.getUTCDate();
  next.setUTCMonth(next.getUTCMonth() + months, 1);
  const last = new Date(next);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  next.setUTCDate(Math.min(day, last.getUTCDate()));
  return isoWithinCalendar(next, date);
}

export function calendarDateLabel(date) {
  return dateFormat.format(utcDate(date));
}

function firstInstallmentInMonth(record, start) {
  const terms = record.terms;
  let low = record.covered;
  let high = terms.count;
  while (low < high) {
    const index = Math.floor((low + high) / 2);
    if (dueDate(terms.start, terms.frequency, index) < start) low = index + 1;
    else high = index;
  }
  return low;
}

export function calendarActivity(records, date, mode) {
  const month = date.slice(0, 7);
  const events = new Map();
  function add(day, entry) {
    if (!events.has(day)) events.set(day, []);
    events.get(day).push(entry);
  }

  for (const record of records) {
    if (mode === "payments") {
      for (const payment of record.history) {
        if (payment.date.startsWith(month)) {
          add(payment.date, { record, amount: payment.amount, method: payment.method });
        }
      }
    } else if (!record.archived && record.balance > 0) {
      const terms = record.terms;
      const first = firstInstallmentInMonth(record, month + "-01");
      for (let index = first; index < terms.count; index += 1) {
        const due = dueDate(terms.start, terms.frequency, index);
        if (!due.startsWith(month)) break;
        const installmentEnd = index === terms.count - 1 ? terms.total : (index + 1) * terms.regular;
        const remaining = installmentEnd - Math.max(record.paid, index * terms.regular);
        add(due, { record, amount: remaining });
      }
    }
  }
  return events;
}

export function calendarGrid(focusDate, selectedDate, events, mode) {
  const start = focusDate.slice(0, 7) + "-01";
  const first = utcDate(start);
  const final = new Date(first);
  final.setUTCMonth(final.getUTCMonth() + 1, 0);
  const lead = first.getUTCDay();
  const length = final.getUTCDate();
  const weeks = Math.ceil((lead + length) / 7);
  const headers = weekdays.map(day => `<th scope="col" abbr="${day}">${day.slice(0, 3)}</th>`).join("");
  let rows = "";

  for (let week = 0; week < weeks; week += 1) {
    let cells = "";
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const number = week * 7 + weekday - lead + 1;
      if (number < 1 || number > length) {
        cells += '<td class="calendar-spacer"></td>';
        continue;
      }
      const date = start.slice(0, 8) + String(number).padStart(2, "0");
      const count = events.get(date)?.length ?? 0;
      const item = mode === "payments" ? "recorded payment" : "unpaid installment";
      const overdue = mode === "dues" && date < DEMO_TODAY && count > 0;
      const current = date === DEMO_TODAY ? ' aria-current="date"' : "";
      cells += `<td aria-selected="${date === selectedDate}">
        <button type="button" class="calendar-day" id="calendar-day-${date}" data-calendar-date="${date}"
          tabindex="${date === focusDate ? 0 : -1}"${current}
          aria-label="${calendarDateLabel(date)}, ${count} ${overdue ? "overdue " : ""}${item}${count === 1 ? "" : "s"}">
          <span class="calendar-day-number" aria-hidden="true">${number}</span>
          <span class="calendar-count${overdue ? " calendar-count-overdue" : ""}${count === 0 ? " calendar-count-empty" : ""}" aria-hidden="true">${count}</span>
        </button>
      </td>`;
    }
    rows += "<tr>" + cells + "</tr>";
  }

  return `
    <div class="calendar-month-title">
      <h2 id="calendar-month-heading" aria-live="polite">${monthFormat.format(first)}</h2>
      <div class="calendar-pager">
        <button type="button" class="button outline compact" id="calendar-prev" aria-label="Previous month"${shiftCalendarMonth(focusDate, -1) === focusDate ? " disabled" : ""}>Previous</button>
        <button type="button" class="button outline compact" id="calendar-today">Today</button>
        <button type="button" class="button outline compact" id="calendar-next" aria-label="Next month"${shiftCalendarMonth(focusDate, 1) === focusDate ? " disabled" : ""}>Next</button>
      </div>
    </div>
    <table class="calendar-grid" role="grid" aria-labelledby="calendar-month-heading">
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}
