import { getTokens, saveTokens } from "./storage";
import type { BalanceDetails, TokenCache } from "./types";

const AUTH_URL = "https://amiapp.dpdc.org.bd/auth/login/generate-bearer";
const BALANCE_URL = "https://amiapp.dpdc.org.bd/usage/usage-service";
const CLIENT_ID = "auth-ui";
const CLIENT_SECRET = "0yFsAl4nN9jX1GGkgOrvpUxDarf2DT40";
const TENANT_CODE = "DPDC";
const TIMEOUT_MS = 30_000;

export function validateCustomerId(id: string): boolean {
  return /^[0-9]{8,12}$/.test(id);
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function generateBearerToken(refreshToken?: string): Promise<TokenCache> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json;charset=UTF-8",
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    tenantCode: TENANT_CODE,
  };
  if (refreshToken) {
    headers["Authorization"] = `Bearer ${refreshToken}`;
  }

  const res = await fetchWithTimeout(AUTH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Auth failed with status ${res.status}`);
  }

  const json = (await res.json()) as Record<string, unknown>;
  const accessToken = json["access_token"] as string | undefined;
  if (!accessToken) throw new Error("No access_token in auth response");

  const expiresIn = typeof json["expires_in"] === "number" ? (json["expires_in"] as number) : 3600;
  const tokens: TokenCache = {
    accessToken,
    refreshToken: (json["refresh_token"] as string | null) ?? null,
    expiry: Date.now() + expiresIn * 1000,
  };
  await saveTokens(tokens);
  return tokens;
}

async function getValidAccessToken(): Promise<string> {
  const cached = await getTokens();
  // Reuse if valid with >1 min buffer
  if (cached && cached.expiry > Date.now() + 60_000) {
    return cached.accessToken;
  }
  // Try refresh
  if (cached?.refreshToken) {
    try {
      const refreshed = await generateBearerToken(cached.refreshToken);
      return refreshed.accessToken;
    } catch {
      // fall through to fresh token
    }
  }
  // Fresh token
  const fresh = await generateBearerToken();
  return fresh.accessToken;
}

function buildQuery(customerId: string): string {
  return `query {
  postBalanceDetails(input: {
    customerNumber: "${customerId}",
    tenantCode: "DPDC"
  }) {
    accountId
    customerName
    customerClass
    mobileNumber
    emailId
    accountType
    balanceRemaining
    connectionStatus
    customerType
    minRecharge
  }
}`;
}

export async function fetchBalanceDetails(customerId: string): Promise<BalanceDetails> {
  const token = await getValidAccessToken();

  const res = await fetchWithTimeout(BALANCE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Authorization: `Bearer ${token}`,
      accessToken: token,
      tenantCode: TENANT_CODE,
    },
    body: JSON.stringify({ query: buildQuery(customerId) }),
  });

  if (res.status === 404) throw new Error("Customer ID not found");
  if (res.status >= 500) throw new Error(`DPDC server error (${res.status})`);

  const json = (await res.json()) as {
    errors?: Array<{ message: string }>;
    data?: { postBalanceDetails?: Record<string, unknown> | null };
  };

  if (Array.isArray(json.errors) && json.errors.length > 0) {
    throw new Error(json.errors[0].message);
  }

  const details = json.data?.postBalanceDetails;
  if (!details) throw new Error("Customer ID not found");

  return {
    accountId: String(details["accountId"] ?? ""),
    customerName: String(details["customerName"] ?? ""),
    customerClass: String(details["customerClass"] ?? ""),
    mobileNumber: (details["mobileNumber"] as string | null) ?? null,
    emailId: (details["emailId"] as string | null) ?? null,
    accountType: String(details["accountType"] ?? ""),
    balanceRemaining: Number(details["balanceRemaining"]) || 0,
    connectionStatus: String(details["connectionStatus"] ?? ""),
    customerType: String(details["customerType"] ?? ""),
    minRecharge: details["minRecharge"] != null ? Number(details["minRecharge"]) : null,
  };
}
