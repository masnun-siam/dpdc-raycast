export interface BalanceDetails {
  accountId: string;
  customerName: string;
  customerClass: string;
  mobileNumber: string | null;
  emailId: string | null;
  accountType: string;
  balanceRemaining: number;
  connectionStatus: string;
  customerType: string;
  minRecharge: number | null;
}

export interface Meter {
  id: string;
  label?: string;
  isPrimary: boolean;
}

export interface CachedBalance {
  data: BalanceDetails;
  fetchedAt: number; // epoch ms
}

export interface TokenCache {
  accessToken: string;
  refreshToken: string | null;
  expiry: number; // epoch ms (absolute)
}

export interface Preferences {
  alertThreshold: string; // e.g. "50" — parsed as float at use site
  refreshInterval: string; // e.g. "30" — minutes, parsed as int at use site
}
