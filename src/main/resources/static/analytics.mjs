import { DEMO_TODAY, money } from "./ledger.mjs";

export const analyticsRanges = [3, 6, 12];

const monthFormat = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const percentFormat = new Intl.NumberFormat("en-PH", {
  style: "percent",
  maximumFractionDigits: 1,
});

function monthIndex(date) {
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
}

export function summarizeAnalytics(records, monthCount, today = DEMO_TODAY) {
  const monthlyTotals = new Map();
  let endMonth = monthIndex(today);
  let collected = 0;
  let outstanding = 0;

  function monthFor(date) {
    const month = monthIndex(date);
    endMonth = Math.max(endMonth, month);
    if (!monthlyTotals.has(month)) monthlyTotals.set(month, { lent: 0, collected: 0 });
    return monthlyTotals.get(month);
  }

  for (const record of records) {
    monthFor(record.start).lent += record.principal;
    for (const payment of record.history) {
      monthFor(payment.date).collected += payment.amount;
    }
    collected += record.paid;
    outstanding += record.balance;
  }

  const firstMonth = endMonth - monthCount + 1;
  const months = Array.from({ length: monthCount }, (_, offset) => {
    const month = firstMonth + offset;
    return {
      label: monthFormat.format(new Date(Date.UTC(Math.floor(month / 12), month % 12, 1))),
      ...(monthlyTotals.get(month) ?? { lent: 0, collected: 0 }),
    };
  });
  return { months, collected, outstanding };
}

function monthlyTrack(amount, max, series) {
  return `<div class="analytics-track"><span class="analytics-bar analytics-${series}"
    style="--bar-width: ${amount / max * 100}%"></span></div>`;
}

function monthlyChart(months, max) {
  if (max === 0) return '<p class="analytics-empty">No lending or payment activity in this period.</p>';
  return `
    <div class="analytics-legend" aria-hidden="true">
      <span><i class="analytics-key analytics-lent"></i>Lent</span>
      <span><i class="analytics-key analytics-collected"></i>Collected</span>
    </div>
    <div class="analytics-monthly" aria-hidden="true">
      <div class="analytics-axis"><span>₱0</span><span>${money(max)}</span></div>
      ${months.map(month => `
        <div class="analytics-month">
          <span class="analytics-month-label">${month.label}</span>
          <div class="analytics-bar-pair">
            ${monthlyTrack(month.lent, max, "lent")}
            ${monthlyTrack(month.collected, max, "collected")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function repaymentChart(collected, outstanding) {
  const total = collected + outstanding;
  if (total === 0) return '<p class="analytics-empty">Add a borrower to see repayment progress.</p>';
  const fraction = collected / total;
  return `
    <div class="analytics-repayment">
      <div class="analytics-ring" style="--progress: ${fraction * 100}%">
        <div class="analytics-ring-center">
          <strong>${percentFormat.format(fraction)}</strong>
          <span>collected</span>
        </div>
      </div>
      <dl class="analytics-repayment-amounts">
        <div>
          <dt><i class="analytics-key analytics-collected" aria-hidden="true"></i>Collected</dt>
          <dd>${money(collected)}</dd>
        </div>
        <div>
          <dt><i class="analytics-key analytics-outstanding" aria-hidden="true"></i>Outstanding</dt>
          <dd>${money(outstanding)}</dd>
        </div>
      </dl>
    </div>
  `;
}

export function analyticsMarkup(records, monthCount, figuresOpen) {
  const { months, collected, outstanding } = summarizeAnalytics(records, monthCount);
  const max = Math.max(...months.map(month => Math.max(month.lent, month.collected)));
  const options = analyticsRanges.map(count =>
    `<option value="${count}"${count === monthCount ? " selected" : ""}>Last ${count} months</option>`
  ).join("");
  const tableRows = months.map(month => `
    <tr><th scope="row">${month.label}</th><td class="numeric">${money(month.lent)}</td>
      <td class="numeric">${money(month.collected)}</td></tr>
  `).join("");

  return `
    <div class="analytics-grid">
      <section class="table-panel analytics-panel" aria-labelledby="analytics-monthly-heading">
        <header class="analytics-heading">
          <div>
            <h2 id="analytics-monthly-heading">Lent vs. collected</h2>
            <p>${months[0].label} – ${months.at(-1).label}</p>
          </div>
          <div class="field analytics-period">
            <label for="analytics-range">Period</label>
            <select id="analytics-range">${options}</select>
          </div>
        </header>
        ${monthlyChart(months, max)}
        <details id="analytics-figures" class="analytics-figures"${figuresOpen ? " open" : ""}>
          <summary id="analytics-figures-toggle">View monthly figures</summary>
          <div class="table-scroll" role="region" aria-label="Monthly figures table" tabindex="0">
            <table>
              <caption class="sr-only">Loan principal by start date and collections by payment date</caption>
              <thead><tr><th scope="col">Month</th><th scope="col" class="numeric">Lent</th>
                <th scope="col" class="numeric">Collected</th></tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </details>
      </section>
      <section class="table-panel analytics-panel" aria-labelledby="analytics-repayment-heading">
        <header class="analytics-heading">
          <div>
            <h2 id="analytics-repayment-heading">Repayment progress</h2>
            <p>All records</p>
          </div>
        </header>
        ${repaymentChart(collected, outstanding)}
      </section>
    </div>
  `;
}
