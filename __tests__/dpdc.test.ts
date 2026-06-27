jest.mock("@raycast/api");
jest.mock("../src/lib/storage");

import { validateCustomerId, fetchBalanceDetails } from "../src/lib/dpdc";
import * as storage from "../src/lib/storage";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockGetTokens = storage.getTokens as jest.MockedFunction<typeof storage.getTokens>;
const mockSaveTokens = storage.saveTokens as jest.MockedFunction<typeof storage.saveTokens>;

beforeEach(() => {
  jest.clearAllMocks();
  mockSaveTokens.mockResolvedValue(undefined);
});

describe("validateCustomerId", () => {
  it("accepts an 8-digit numeric ID", () => {
    expect(validateCustomerId("31719842")).toBe(true);
  });
  it("accepts a 12-digit numeric ID", () => {
    expect(validateCustomerId("317198421234")).toBe(true);
  });
  it("rejects 7 digits (too short)", () => {
    expect(validateCustomerId("3171984")).toBe(false);
  });
  it("rejects 13 digits (too long)", () => {
    expect(validateCustomerId("3171984212345")).toBe(false);
  });
  it("rejects non-numeric characters", () => {
    expect(validateCustomerId("3171984X")).toBe(false);
  });
  it("rejects empty string", () => {
    expect(validateCustomerId("")).toBe(false);
  });
});

const authResponse = {
  access_token: "tok-abc",
  refresh_token: "ref-xyz",
  expires_in: 3600,
};

const balanceResponse = {
  data: {
    postBalanceDetails: {
      accountId: "ACC999",
      customerName: "John",
      customerClass: "Residential",
      mobileNumber: "01711000000",
      emailId: null,
      accountType: "Prepaid",
      balanceRemaining: 1234.5,
      connectionStatus: "active",
      customerType: "Domestic",
      minRecharge: 50,
    },
  },
};

describe("fetchBalanceDetails", () => {
  it("fetches balance with a fresh token when none cached", async () => {
    mockGetTokens.mockResolvedValue(null);
    mockFetch
      .mockResolvedValueOnce({ status: 200, json: async () => authResponse }) // auth
      .mockResolvedValueOnce({ status: 200, json: async () => balanceResponse }); // balance

    const result = await fetchBalanceDetails("31719842");
    expect(result.customerName).toBe("John");
    expect(result.balanceRemaining).toBe(1234.5);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("reuses a valid cached token", async () => {
    mockGetTokens.mockResolvedValue({
      accessToken: "cached-tok",
      refreshToken: null,
      expiry: Date.now() + 3_600_000,
    });
    mockFetch.mockResolvedValueOnce({ status: 200, json: async () => balanceResponse });

    const result = await fetchBalanceDetails("31719842");
    expect(result.accountId).toBe("ACC999");
    expect(mockFetch).toHaveBeenCalledTimes(1); // no auth call
  });

  it("throws 'Customer ID not found' on 404", async () => {
    mockGetTokens.mockResolvedValue({
      accessToken: "tok",
      refreshToken: null,
      expiry: Date.now() + 3_600_000,
    });
    mockFetch.mockResolvedValueOnce({ status: 404, json: async () => ({}) });

    await expect(fetchBalanceDetails("99999999")).rejects.toThrow("Customer ID not found");
  });

  it("throws on GraphQL errors array", async () => {
    mockGetTokens.mockResolvedValue({
      accessToken: "tok",
      refreshToken: null,
      expiry: Date.now() + 3_600_000,
    });
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ errors: [{ message: "Invalid customer" }], data: null }),
    });

    await expect(fetchBalanceDetails("12345678")).rejects.toThrow("Invalid customer");
  });

  it("throws on null postBalanceDetails (ID not found GraphQL null)", async () => {
    mockGetTokens.mockResolvedValue({
      accessToken: "tok",
      refreshToken: null,
      expiry: Date.now() + 3_600_000,
    });
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ data: { postBalanceDetails: null } }),
    });

    await expect(fetchBalanceDetails("12345678")).rejects.toThrow("Customer ID not found");
  });
});
