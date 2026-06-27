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
import { showFailureToast } from "@raycast/utils";
import { useState } from "react";
import type { BalanceDetails, Preferences } from "./lib/types";
import { formatBalance, buildShareText } from "./lib/format";
import { isSaved, addMeter, setCachedBalance } from "./lib/storage";
import { fetchBalanceDetails, validateCustomerId } from "./lib/dpdc";

// ─── Save Meter Form (shown after a successful ad-hoc lookup) ────────────────
function SaveMeterForm({ id, onSave }: { id: string; onSave: () => void }) {
  const { pop } = useNavigation();

  async function handleSubmit(values: { label: string }) {
    await addMeter(id, values.label.trim() || undefined);
    await showToast({ style: Toast.Style.Success, title: "Meter saved" });
    onSave();
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Meter" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description title="Customer Id" text={id} />
      <Form.TextField id="label" title="Label (optional)" placeholder="e.g. Home, Office" />
    </Form>
  );
}

// ─── Balance Result Detail ───────────────────────────────────────────────────
function BalanceDetail({
  id,
  balance,
  alreadySaved,
  threshold,
  onSaved,
}: {
  id: string;
  balance: BalanceDetails;
  alreadySaved: boolean;
  threshold: number;
  onSaved: () => void;
}) {
  useNavigation();
  const isLow = balance.balanceRemaining <= threshold;
  const isActive = balance.connectionStatus.toLowerCase() === "active";
  const shareText = buildShareText(id, balance);

  return (
    <List navigationTitle={`Balance: ${id}`} isShowingDetail>
      <List.Item
        title={balance.customerName}
        subtitle={id}
        detail={
          <List.Item.Detail
            metadata={
              <List.Item.Detail.Metadata>
                <List.Item.Detail.Metadata.Label
                  title="Balance"
                  text={formatBalance(balance.balanceRemaining)}
                />
                <List.Item.Detail.Metadata.TagList title="Status">
                  <List.Item.Detail.Metadata.TagList.Item
                    text={balance.connectionStatus}
                    color={isLow ? Color.Red : isActive ? Color.Green : Color.Orange}
                  />
                </List.Item.Detail.Metadata.TagList>
                <List.Item.Detail.Metadata.Separator />
                <List.Item.Detail.Metadata.Label title="Customer Name" text={balance.customerName} />
                <List.Item.Detail.Metadata.Label title="Account Id" text={balance.accountId} />
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
                  <List.Item.Detail.Metadata.Label title="Min Recharge" text={formatBalance(balance.minRecharge)} />
                )}
              </List.Item.Detail.Metadata>
            }
          />
        }
        actions={
          <ActionPanel>
            {!alreadySaved && (
              <Action.Push
                title="Save Meter"
                icon={Icon.Plus}
                shortcut={{ modifiers: ["cmd"], key: "s" }}
                target={<SaveMeterForm id={id} onSave={onSaved} />}
              />
            )}
            <Action.CopyToClipboard title="Copy Balance" content={formatBalance(balance.balanceRemaining)} />
            <Action.CopyToClipboard title="Copy Customer Id" content={id} />
            <Action.CopyToClipboard title="Copy All Details" content={shareText} />
          </ActionPanel>
        }
      />
    </List>
  );
}

// ─── Main: Customer Id lookup form ──────────────────────────────────────────
export default function CheckBalance() {
  const { push } = useNavigation();
  const prefs = getPreferenceValues<Preferences>();
  const threshold = parseFloat(prefs.alertThreshold) || 50;

  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(values: { id: string }) {
    const trimId = values.id.trim();
    if (!validateCustomerId(trimId)) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Invalid Customer Id",
        message: "Must be 8–12 digits, numbers only.",
      });
      return;
    }

    setIsLoading(true);
    try {
      await showToast({ style: Toast.Style.Animated, title: "Fetching balance…" });
      const balance = await fetchBalanceDetails(trimId);
      await setCachedBalance(trimId, balance);
      const saved = await isSaved(trimId);
      push(
        <BalanceDetail
          id={trimId}
          balance={balance}
          alreadySaved={saved}
          threshold={threshold}
          onSaved={() => {
            // Nothing to revalidate here; My Meters command handles its own data
          }}
        />
      );
    } catch (err) {
      await showFailureToast(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Check Balance" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="id" title="Customer Id" placeholder="e.g. 31719842" info="8–12 digit numeric Id" />
    </Form>
  );
}
