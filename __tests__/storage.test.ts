import { resetMockStore, LocalStorage } from "../__mocks__/@raycast/api";
jest.mock("@raycast/api");

import {
  getMeters,
  addMeter,
  removeMeter,
  setPrimary,
  isSaved,
  updateLabel,
  getTokens,
  saveTokens,
  getCachedBalance,
  setCachedBalance,
} from "../src/lib/storage";
import type { BalanceDetails, TokenCache } from "../src/lib/types";

const sampleBalance: BalanceDetails = {
  accountId: "ACC1",
  customerName: "Alice",
  customerClass: "Residential",
  mobileNumber: null,
  emailId: null,
  accountType: "Prepaid",
  balanceRemaining: 500,
  connectionStatus: "active",
  customerType: "Domestic",
  minRecharge: 50,
};

beforeEach(async () => {
  resetMockStore();
  // Ensure clean state by clearing LocalStorage
  await LocalStorage.clear();
});

describe("getMeters", () => {
  it("returns empty array when nothing stored", async () => {
    expect(await getMeters()).toEqual([]);
  });
});

describe("addMeter", () => {
  it("adds a meter and makes it primary when it's the first", async () => {
    await addMeter("11111111");
    const meters = await getMeters();
    expect(meters).toHaveLength(1);
    expect(meters[0]).toEqual({ id: "11111111", label: undefined, isPrimary: true });
  });

  it("second meter is not primary", async () => {
    await addMeter("11111111");
    await addMeter("22222222", "Office");
    const meters = await getMeters();
    expect(meters[0].isPrimary).toBe(true);
    expect(meters[1].isPrimary).toBe(false);
    expect(meters[1].label).toBe("Office");
  });

  it("is a no-op if ID already saved", async () => {
    await addMeter("11111111");
    await addMeter("11111111");
    expect((await getMeters())).toHaveLength(1);
  });
});

describe("updateLabel", () => {
  it("updates label for matching meter", async () => {
    await addMeter("11111111", "Home");
    await updateLabel("11111111", "House");
    const meters = await getMeters();
    expect(meters[0].label).toBe("House");
  });
});

describe("removeMeter", () => {
  it("removes the meter", async () => {
    await addMeter("11111111");
    await removeMeter("11111111");
    expect((await getMeters())).toHaveLength(0);
  });

  it("reassigns primary to first remaining when primary is removed", async () => {
    await addMeter("11111111");
    await addMeter("22222222");
    await removeMeter("11111111");
    const meters = await getMeters();
    expect(meters[0].id).toBe("22222222");
    expect(meters[0].isPrimary).toBe(true);
  });
});

describe("setPrimary", () => {
  it("sets the given meter as primary and clears others", async () => {
    await addMeter("11111111");
    await addMeter("22222222");
    await setPrimary("22222222");
    const meters = await getMeters();
    expect(meters.find((m) => m.id === "11111111")?.isPrimary).toBe(false);
    expect(meters.find((m) => m.id === "22222222")?.isPrimary).toBe(true);
  });
});

describe("isSaved", () => {
  it("returns false when not saved", async () => {
    expect(await isSaved("11111111")).toBe(false);
  });

  it("returns true when saved", async () => {
    await addMeter("11111111");
    expect(await isSaved("11111111")).toBe(true);
  });
});

describe("tokens", () => {
  const tokens: TokenCache = {
    accessToken: "abc",
    refreshToken: "def",
    expiry: Date.now() + 3600_000,
  };

  it("returns null when no tokens stored", async () => {
    expect(await getTokens()).toBeNull();
  });

  it("saves and retrieves tokens", async () => {
    await saveTokens(tokens);
    const retrieved = await getTokens();
    expect(retrieved?.accessToken).toBe("abc");
    expect(retrieved?.refreshToken).toBe("def");
  });
});

describe("balance cache", () => {
  it("returns null for uncached meter", async () => {
    expect(await getCachedBalance("11111111")).toBeNull();
  });

  it("saves and retrieves cached balance", async () => {
    await setCachedBalance("11111111", sampleBalance);
    const cached = await getCachedBalance("11111111");
    expect(cached?.data.balanceRemaining).toBe(500);
    expect(typeof cached?.fetchedAt).toBe("number");
  });

  it("does not overwrite cache for other IDs", async () => {
    await setCachedBalance("11111111", sampleBalance);
    await setCachedBalance("22222222", { ...sampleBalance, balanceRemaining: 100 });
    expect((await getCachedBalance("11111111"))?.data.balanceRemaining).toBe(500);
    expect((await getCachedBalance("22222222"))?.data.balanceRemaining).toBe(100);
  });
});
