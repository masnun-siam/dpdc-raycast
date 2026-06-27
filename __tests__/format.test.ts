import { formatBalance, formatTimeAgo, buildShareText } from "../src/lib/format";
import type { BalanceDetails } from "../src/lib/types";

describe("formatBalance", () => {
  it("formats a whole number with 2 decimals", () => {
    expect(formatBalance(1234)).toBe("৳1,234.00");
  });

  it("formats a decimal balance with grouping", () => {
    expect(formatBalance(1234.5)).toBe("৳1,234.50");
  });

  it("formats zero", () => {
    expect(formatBalance(0)).toBe("৳0.00");
  });

  it("formats a negative balance with leading minus", () => {
    expect(formatBalance(-50.75)).toBe("-৳50.75");
  });

  it("formats small balance under 1000", () => {
    expect(formatBalance(88)).toBe("৳88.00");
  });
});

describe("formatTimeAgo", () => {
  const now = Date.now();

  it("returns 'just now' for < 1 minute ago", () => {
    expect(formatTimeAgo(now - 30_000)).toBe("just now");
  });

  it("returns minutes for < 1 hour ago", () => {
    expect(formatTimeAgo(now - 12 * 60_000)).toBe("12m ago");
  });

  it("returns hours for < 24 hours ago", () => {
    expect(formatTimeAgo(now - 2 * 60 * 60_000)).toBe("2h ago");
  });

  it("returns days for >= 24 hours ago", () => {
    expect(formatTimeAgo(now - 25 * 60 * 60_000)).toBe("1d ago");
  });
});

describe("buildShareText", () => {
  const balance: BalanceDetails = {
    accountId: "ACC123",
    customerName: "John Doe",
    customerClass: "Residential",
    mobileNumber: "01711000000",
    emailId: null,
    accountType: "Prepaid",
    balanceRemaining: 1234.5,
    connectionStatus: "active",
    customerType: "Domestic",
    minRecharge: 50,
  };

  it("includes key fields", () => {
    const text = buildShareText("31719842", balance);
    expect(text).toContain("Customer ID: 31719842");
    expect(text).toContain("Balance: ৳1,234.50");
    expect(text).toContain("Mobile: 01711000000");
  });

  it("omits null fields", () => {
    const text = buildShareText("31719842", balance);
    expect(text).not.toContain("Email:");
  });
});
