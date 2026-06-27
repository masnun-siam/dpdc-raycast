import { LocalStorage } from "@raycast/api";
import type { Meter, CachedBalance, TokenCache, BalanceDetails } from "./types";

const METERS_KEY = "dpdc_meters";
const TOKENS_KEY = "dpdc_tokens";
const CACHE_KEY = "dpdc_balance_cache";

export async function getMeters(): Promise<Meter[]> {
  const raw = await LocalStorage.getItem<string>(METERS_KEY);
  return raw ? (JSON.parse(raw) as Meter[]) : [];
}

export async function addMeter(id: string, label?: string): Promise<void> {
  const meters = await getMeters();
  if (meters.some((m) => m.id === id)) return; // already saved, no-op
  const isPrimary = meters.length === 0; // first meter becomes primary
  meters.push({ id, label, isPrimary });
  await LocalStorage.setItem(METERS_KEY, JSON.stringify(meters));
}

export async function updateLabel(id: string, label: string): Promise<void> {
  const meters = await getMeters();
  const updated = meters.map((m) => (m.id === id ? { ...m, label } : m));
  await LocalStorage.setItem(METERS_KEY, JSON.stringify(updated));
}

export async function removeMeter(id: string): Promise<void> {
  let meters = await getMeters();
  const wasPrimary = meters.find((m) => m.id === id)?.isPrimary ?? false;
  meters = meters.filter((m) => m.id !== id);
  if (wasPrimary && meters.length > 0) {
    meters[0] = { ...meters[0], isPrimary: true };
  }
  await LocalStorage.setItem(METERS_KEY, JSON.stringify(meters));
}

export async function setPrimary(id: string): Promise<void> {
  const meters = await getMeters();
  const updated = meters.map((m) => ({ ...m, isPrimary: m.id === id }));
  await LocalStorage.setItem(METERS_KEY, JSON.stringify(updated));
}

export async function isSaved(id: string): Promise<boolean> {
  const meters = await getMeters();
  return meters.some((m) => m.id === id);
}

export async function getTokens(): Promise<TokenCache | null> {
  const raw = await LocalStorage.getItem<string>(TOKENS_KEY);
  return raw ? (JSON.parse(raw) as TokenCache) : null;
}

export async function saveTokens(tokens: TokenCache): Promise<void> {
  await LocalStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export async function getCachedBalance(id: string): Promise<CachedBalance | null> {
  const raw = await LocalStorage.getItem<string>(CACHE_KEY);
  const cache: Record<string, CachedBalance> = raw ? JSON.parse(raw) : {};
  return cache[id] ?? null;
}

export async function setCachedBalance(id: string, data: BalanceDetails): Promise<void> {
  const raw = await LocalStorage.getItem<string>(CACHE_KEY);
  const cache: Record<string, CachedBalance> = raw ? JSON.parse(raw) : {};
  cache[id] = { data, fetchedAt: Date.now() };
  await LocalStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}
