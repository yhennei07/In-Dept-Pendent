import { applyLedgerAction, initialLedger } from "./ledger.mjs";

export const sampleLedgerKey = "current";

export async function loadLedger(key) {
  const username = key.replace("account-ledger:", "");
  try {
    const response = await fetch(`/api/ledger?username=${encodeURIComponent(username)}`);
    if (!response.ok) return initialLedger(false);
    const data = await response.json();
    // If database has no records yet, return a clean empty ledger
    return data && Array.isArray(data.loans) ? data : initialLedger(false);
  } catch (error) {
    console.error("Failed to load ledger from Spring Boot:", error);
    return initialLedger(false);
  }
}

export async function saveLedger(key, action) {
  const username = key.replace("account-ledger:", "");
  // Load current state, apply the UI action (add borrower, record payment, archive, etc.)
  const currentSnapshot = await loadLedger(key);
  const updatedSnapshot = applyLedgerAction(currentSnapshot, action);

  try {
    const response = await fetch("/api/ledger/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        action,
        snapshot: updatedSnapshot
      })
    });

    if (!response.ok) {
      throw new Error("Server failed to save ledger action.");
    }
    const saved = await response.json();
    return saved && Array.isArray(saved.loans) ? saved : updatedSnapshot;
  } catch (error) {
    console.error("Failed to save action to Spring Boot:", error);
    throw error;
  }
}
