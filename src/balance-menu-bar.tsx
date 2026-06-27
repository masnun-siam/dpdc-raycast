import { getPreferenceValues, Icon, LaunchType, MenuBarExtra, openCommandPreferences } from "@raycast/api";
import { useCachedPromise, showFailureToast } from "@raycast/utils";
import { getMeters, getCachedBalance, setCachedBalance } from "./lib/storage";
import { fetchBalanceDetails } from "./lib/dpdc";
import { formatBalance } from "./lib/format";
import type { BalanceDetails, Preferences } from "./lib/types";

interface MenuRow {
  id: string;
  label: string;
  isPrimary: boolean;
  balance: BalanceDetails | null;
  error: string | null;
}

async function loadMenuData(): Promise<MenuRow[]> {
  const meters = await getMeters();
  const prefs = getPreferenceValues<Preferences>();
  const cacheTTL = parseInt(prefs.refreshInterval) * 60_000;

  return Promise.all(
    meters.map(async (meter): Promise<MenuRow> => {
      const cached = await getCachedBalance(meter.id);
      const isStale = !cached || Date.now() - cached.fetchedAt > cacheTTL;

      if (!isStale && cached) {
        return {
          id: meter.id,
          label: meter.label ?? meter.id,
          isPrimary: meter.isPrimary,
          balance: cached.data,
          error: null,
        };
      }
      try {
        const data = await fetchBalanceDetails(meter.id);
        await setCachedBalance(meter.id, data);
        return {
          id: meter.id,
          label: meter.label ?? meter.id,
          isPrimary: meter.isPrimary,
          balance: data,
          error: null,
        };
      } catch (err) {
        if (cached) {
          return {
            id: meter.id,
            label: meter.label ?? meter.id,
            isPrimary: meter.isPrimary,
            balance: cached.data,
            error: String(err),
          };
        }
        return {
          id: meter.id,
          label: meter.label ?? meter.id,
          isPrimary: meter.isPrimary,
          balance: null,
          error: String(err),
        };
      }
    })
  );
}

export default function BalanceMenuBar() {
  const prefs = getPreferenceValues<Preferences>();
  const threshold = parseFloat(prefs.alertThreshold) || 50;

  const { data, isLoading, revalidate } = useCachedPromise(loadMenuData, [], {
    keepPreviousData: true,
  });

  const rows = data ?? [];
  const primary = rows.find((r) => r.isPrimary);
  const anyLow = rows.some((r) => r.balance != null && r.balance.balanceRemaining <= threshold);

  // Title: primary balance or loading indicator
  const title = primary?.balance ? formatBalance(primary.balance.balanceRemaining) : isLoading ? "⟳" : "—";
  const icon = anyLow
    ? { source: Icon.ExclamationMark, tintColor: { light: "#ff0000", dark: "#ff5555", adjustContrast: false } }
    : "⚡";

  async function handleRefresh() {
    try {
      revalidate();
    } catch (err) {
      await showFailureToast(err instanceof Error ? err : new Error(String(err)));
    }
  }

  async function openMyMeters() {
    const { launchCommand } = await import("@raycast/api");
    await launchCommand({ name: "my-meters", type: LaunchType.UserInitiated });
  }

  return (
    <MenuBarExtra icon={icon} title={title} isLoading={isLoading}>
      {rows.length === 0 ? (
        <MenuBarExtra.Item title="No meters saved" onAction={openMyMeters} />
      ) : (
        <MenuBarExtra.Section title="Meters">
          {rows.map((row) => {
            const balanceText = row.balance ? formatBalance(row.balance.balanceRemaining) : row.error ? "Error" : "…";
            const isLow = row.balance != null && row.balance.balanceRemaining <= threshold;
            const prefix = row.isPrimary ? "⭐ " : "   ";
            const lowFlag = isLow ? " 🔴" : "";

            return (
              <MenuBarExtra.Item
                key={row.id}
                title={`${prefix}${row.label}   ${balanceText}${lowFlag}`}
                onAction={openMyMeters}
              />
            );
          })}
        </MenuBarExtra.Section>
      )}

      <MenuBarExtra.Section>
        <MenuBarExtra.Item title="Refresh Now" icon={Icon.ArrowClockwise} onAction={handleRefresh} />
        <MenuBarExtra.Item title="Open My Meters" icon={Icon.List} onAction={openMyMeters} />
        <MenuBarExtra.Item title="Preferences…" icon={Icon.Gear} onAction={openCommandPreferences} />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
