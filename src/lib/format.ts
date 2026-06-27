/**
 * Format a balance number as Bangladeshi Taka with locale grouping.
 * e.g. 1234.5 → "৳1,234.50"
 */
export function formatBalance(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-৳${formatted}` : `৳${formatted}`;
}

/**
 * Human-readable relative time since a fetchedAt epoch timestamp.
 * e.g. formatTimeAgo(Date.now() - 70_000) → "1m ago"
 */
export function formatTimeAgo(fetchedAt: number): string {
  const diffMs = Date.now() - fetchedAt;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
}

/**
 * Build the plain-text share block matching the mobile app's Share Details.
 */
export function buildShareText(id: string, b: import("./types").BalanceDetails): string {
  return [
    `DPDC Balance Details`,
    `Customer ID: ${id}`,
    `Name: ${b.customerName}`,
    `Account ID: ${b.accountId}`,
    `Balance: ${formatBalance(b.balanceRemaining)}`,
    `Status: ${b.connectionStatus}`,
    `Class: ${b.customerClass}`,
    `Type: ${b.customerType}`,
    `Account Type: ${b.accountType}`,
    b.mobileNumber ? `Mobile: ${b.mobileNumber}` : null,
    b.emailId ? `Email: ${b.emailId}` : null,
    b.minRecharge != null ? `Min Recharge: ${formatBalance(b.minRecharge)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
