import {
  Action,
  ActionPanel,
  Color,
  Form,
  getPreferenceValues,
  Icon,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useCachedPromise, showFailureToast } from "@raycast/utils";
import { useCallback } from "react";
import type { BalanceDetails, Meter, Preferences } from "./lib/types";
import { formatBalance, formatTimeAgo, buildShareText } from "./lib/format";
import {
  getMeters,
  addMeter,
  updateLabel,
  removeMeter,
  setPrimary,
  getCachedBalance,
  setCachedBalance,
} from "./lib/storage";
import { fetchBalanceDetails, validateCustomerId } from "./lib/dpdc";

// ─── Data shape returned by loadAll ─────────────────────────────────────────
interface MeterRow {
  meter: Meter;
  balance: BalanceDetails | null;
  fetchedAt: number;
  stale: boolean;
  error: string | null;
}

// ─── Load all meters with cached / fresh balances ───────────────────────────
async function loadAll(): Promise<MeterRow[]> {
  const meters = await getMeters();
  const prefs = getPreferenceValues<Preferences>();
  const cacheTTL = parseInt(prefs.refreshInterval) * 60_000;

  return Promise.all(
    meters.map(async (meter): Promise<MeterRow> => {
      const cached = await getCachedBalance(meter.id);
      const isStale = !cached || Date.now() - cached.fetchedAt > cacheTTL;

      if (!isStale && cached) {
        return { meter, balance: cached.data, fetchedAt: cached.fetchedAt, stale: false, error: null };
      }
      try {
        const data = await fetchBalanceDetails(meter.id);
        await setCachedBalance(meter.id, data);
        return { meter, balance: data, fetchedAt: Date.now(), stale: false, error: null };
      } catch (err) {
        if (cached) {
          return { meter, balance: cached.data, fetchedAt: cached.fetchedAt, stale: true, error: String(err) };
        }
        return { meter, balance: null, fetchedAt: 0, stale: false, error: String(err) };
      }
    })
  );
}

// ─── Add Meter Form ──────────────────────────────────────────────────────────
function AddMeterForm({ onAdd }: { onAdd: () => void }) {
  const { pop } = useNavigation();

  async function handleSubmit(values: { id: string; label: string }) {
    const trimId = values.id.trim();
    const trimLabel = values.label.trim() || undefined;

    if (!validateCustomerId(trimId)) {
      await showToast({ style: Toast.Style.Failure, title: "Invalid Customer ID", message: "Must be 8–12 digits." });
      return;
    }

    await showToast({ style: Toast.Style.Animated, title: "Checking meter…" });
    try {
      await fetchBalanceDetails(trimId); // validate ID exists before saving
      await addMeter(trimId, trimLabel);
      await showToast({ style: Toast.Style.Success, title: "Meter saved" });
      onAdd();
      pop();
    } catch (err) {
      await showFailureToast(err instanceof Error ? err : new Error(String(err)));
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Meter" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="id" title="Customer ID" placeholder="e.g. 31719842" />
      <Form.TextField id="label" title="Label (optional)" placeholder="e.g. Home, Office" />
    </Form>
  );
}

// ─── Edit Label Form ─────────────────────────────────────────────────────────
function EditLabelForm({ meter, onSave }: { meter: Meter; onSave: () => void }) {
  const { pop } = useNavigation();

  async function handleSubmit(values: { label: string }) {
    await updateLabel(meter.id, values.label.trim());
    onSave();
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Label" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="label" title="Label" defaultValue={meter.label ?? ""} />
    </Form>
  );
}

// ─── Main List Component ─────────────────────────────────────────────────────
export default function MyMeters() {
  useNavigation();
  const prefs = getPreferenceValues<Preferences>();
  const threshold = parseFloat(prefs.alertThreshold) || 50;

  const { data, isLoading, revalidate } = useCachedPromise(loadAll, [], {
    keepPreviousData: true,
  });

  const refresh = useCallback(() => {
    revalidate();
  }, [revalidate]);

  const rows = data ?? [];

  return (
    <List isLoading={isLoading} isShowingDetail={rows.length > 0}>
      {rows.length === 0 && !isLoading ? (
        <List.EmptyView
          icon="🔌"
          title="No meters yet"
          description="Press ⌘N to add your DPDC Customer ID"
          actions={
            <ActionPanel>
              <Action.Push
                title="Add Meter"
                shortcut={{ modifiers: ["cmd"], key: "n" }}
                target={<AddMeterForm onAdd={refresh} />}
              />
            </ActionPanel>
          }
        />
      ) : (
        rows.map((row) => {
          const { meter, balance, fetchedAt, stale, error } = row;
          const isLow = balance != null && balance.balanceRemaining <= threshold;
          const isActive = balance?.connectionStatus.toLowerCase() === "active";
          const displayName = meter.label ?? meter.id;
          const shortId = meter.id.length > 8 ? `${meter.id.slice(0, 4)}…${meter.id.slice(-4)}` : meter.id;
          const shareText = balance ? buildShareText(meter.id, balance) : "";

          const subtitleParts = [];
          if (meter.label) subtitleParts.push(shortId);
          if (fetchedAt > 0) subtitleParts.push(`updated ${formatTimeAgo(fetchedAt)}${stale ? " (stale)" : ""}`);
          if (error && !balance) subtitleParts.push("error");

          async function handleRemove() {
            await removeMeter(meter.id);
            refresh();
          }

          async function handleSetPrimary() {
            await setPrimary(meter.id);
            refresh();
          }

          async function handleRefreshItem() {
            try {
              const data = await fetchBalanceDetails(meter.id);
              await setCachedBalance(meter.id, data);
              refresh();
            } catch (err) {
              await showFailureToast(err instanceof Error ? err : new Error(String(err)));
            }
          }

          return (
            <List.Item
              key={meter.id}
              icon={meter.isPrimary ? "⭐" : Icon.Circle}
              title={displayName}
              subtitle={subtitleParts.join(" · ")}
              accessories={[
                ...(balance
                  ? [
                      {
                        tag: {
                          value: isActive ? "active" : "inactive",
                          color: isLow ? Color.Red : isActive ? Color.Green : Color.Orange,
                        },
                      },
                      { text: formatBalance(balance.balanceRemaining) },
                    ]
                  : error
                  ? [{ tag: { value: "error", color: Color.Red } }]
                  : []),
              ]}
              detail={
                <List.Item.Detail
                  metadata={
                    balance ? (
                      <List.Item.Detail.Metadata>
                        <List.Item.Detail.Metadata.Label
                          title="Balance"
                          text={`${formatBalance(balance.balanceRemaining)}${stale ? " (stale)" : ""}`}
                        />
                        <List.Item.Detail.Metadata.TagList title="Status">
                          <List.Item.Detail.Metadata.TagList.Item
                            text={balance.connectionStatus}
                            color={isLow ? Color.Red : isActive ? Color.Green : Color.Orange}
                          />
                        </List.Item.Detail.Metadata.TagList>
                        <List.Item.Detail.Metadata.Separator />
                        <List.Item.Detail.Metadata.Label title="Customer Name" text={balance.customerName} />
                        <List.Item.Detail.Metadata.Label title="Account ID" text={balance.accountId} />
                        <List.Item.Detail.Metadata.Label title="Customer Class" text={balance.customerClass} />
                        <List.Item.Detail.Metadata.Label title="Customer Type" text={balance.customerType} />
                        <List.Item.Detail.Metadata.Label title="Account Type" text={balance.accountType} />
                        {balance.mobileNumber && (
                          <List.Item.Detail.Metadata.Label title="Mobile" text={balance.mobileNumber} />
                        )}
                        {balance.emailId && (
                          <List.Item.Detail.Metadata.Label title="Email" text={balance.emailId} />
                        )}
                        {balance.minRecharge != null && (
                          <List.Item.Detail.Metadata.Label
                            title="Min Recharge"
                            text={formatBalance(balance.minRecharge)}
                          />
                        )}
                      </List.Item.Detail.Metadata>
                    ) : (
                      <List.Item.Detail.Metadata>
                        <List.Item.Detail.Metadata.Label title="Error" text={error ?? "No data"} />
                      </List.Item.Detail.Metadata>
                    )
                  }
                />
              }
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
                    <Action
                      title="Refresh"
                      icon={Icon.ArrowClockwise}
                      shortcut={{ modifiers: ["cmd"], key: "r" }}
                      onAction={handleRefreshItem}
                    />
                    {!meter.isPrimary && (
                      <Action
                        title="Set as Primary"
                        icon={Icon.Star}
                        shortcut={{ modifiers: ["cmd"], key: "p" }}
                        onAction={handleSetPrimary}
                      />
                    )}
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    {balance && (
                      <>
                        <Action.CopyToClipboard
                          title="Copy Balance"
                          content={formatBalance(balance.balanceRemaining)}
                        />
                        <Action.CopyToClipboard title="Copy Customer Id" content={meter.id} />
                        <Action.CopyToClipboard title="Copy All Details" content={shareText} />
                        <Action.CreateQuicklink
                          quicklink={{
                            link: `raycast://extensions/masnun-siam/dpdc-balance/check-balance?id=${meter.id}`,
                            name: `DPDC ${displayName}`,
                          }}
                        />
                      </>
                    )}
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    <Action.Push
                      title="Add Meter"
                      icon={Icon.Plus}
                      shortcut={{ modifiers: ["cmd"], key: "n" }}
                      target={<AddMeterForm onAdd={refresh} />}
                    />
                    <Action.Push
                      title="Edit Label"
                      icon={Icon.Pencil}
                      target={<EditLabelForm meter={meter} onSave={refresh} />}
                    />
                    <Action
                      title="Remove Meter"
                      icon={Icon.Trash}
                      style={Action.Style.Destructive}
                      onAction={handleRemove}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          );
        })
      )}
    </List>
  );
}
