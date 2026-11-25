const usernamePattern = /^[a-z0-9._-]{3,32}$/i;

export function usernameError(username) {
  if (!username) return "Required";
  if (!usernamePattern.test(username)) {
    return "Use 3–32 letters, numbers, periods, underscores, or hyphens.";
  }
  return "";
}

export async function authenticate(username, password) {
  if (usernameError(username)) return null;
  username = username.toLowerCase();

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.ledgerKey || ("account-ledger:" + username);
  } catch (error) {
    console.error("Login request failed:", error);
    return null;
  }
}

export async function register(username, password) {
  if (usernameError(username)) return null;
  username = username.toLowerCase();

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role: "ADMIN" })
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.ledgerKey || ("account-ledger:" + username);
  } catch (error) {
    console.error("Register request failed:", error);
    return null;
  }
}

