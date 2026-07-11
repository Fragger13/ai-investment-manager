import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { FileUp, Sparkles } from "lucide-react-native";
import { Body, Card, PressableScale } from "@/components/ui";
import { colors, radius, spacing } from "@/constants/theme";
import { api, type DocumentAnalysis } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { ChoiceCards, CurrencyField, DateField, InputField, QuestionLabel } from "./fields";
import { FAMILY_OPTIONS, SALARY_DAY_OPTIONS, formatINRInput, type OnboardingDraft } from "./logic";

type StepProps = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
};

export function AboutStep({ draft, update }: StepProps) {
  const eighteenYearsAgo = new Date();
  eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
  return (
    <View style={{ gap: spacing.lg }}>
      <InputField
        label="Your name"
        value={draft.name}
        onChangeText={(text) => update({ name: text.replace(/[^\p{L}\s.'-]/gu, "") })}
        placeholder="e.g., Rohan Sharma"
        autoComplete="name"
      />
      <DateField
        label="Date of birth"
        value={draft.dateOfBirth}
        onChange={(iso) => update({ dateOfBirth: iso })}
        maximumDate={new Date()}
        placeholder="Papa plans retirement around this"
      />
      <InputField
        label="City"
        value={draft.city}
        onChangeText={(text) => update({ city: text })}
        placeholder="e.g., Bengaluru"
      />
      <InputField
        label="What do you do?"
        value={draft.occupation}
        onChangeText={(text) => update({ occupation: text })}
        placeholder="e.g., Product manager, founder, student"
      />
      <View style={{ gap: spacing.sm }}>
        <QuestionLabel>Family status</QuestionLabel>
        <ChoiceCards options={FAMILY_OPTIONS} selected={draft.maritalStatus} onSelect={(value) => update({ maritalStatus: value })} />
      </View>
    </View>
  );
}

export function IncomeStep({ draft, update }: StepProps) {
  const inflow = draft.monthlySalary + draft.otherIncome;
  return (
    <View style={{ gap: spacing.lg }}>
      <UploadCard draft={draft} update={update} />
      <CurrencyField
        label="In-hand salary"
        value={draft.monthlySalary}
        onChange={(value) => update({ monthlySalary: value })}
        placeholder="e.g., 60,000"
        helper="What actually reaches your bank each month, after tax and PF. Not your CTC."
      />
      <CurrencyField
        label="Other income"
        value={draft.otherIncome}
        onChange={(value) => update({ otherIncome: value })}
        placeholder="Rent, freelance, dividends"
        optional
      />
      {inflow > 0 ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total inflow</Text>
          <Text style={styles.totalValue}>₹{formatINRInput(inflow)}</Text>
        </View>
      ) : null}
      <CurrencyField
        label="How much can you invest this month?"
        value={draft.investableThisMonth}
        onChange={(value) => update({ investableThisMonth: value })}
        placeholder="e.g., 15,000"
        optional
        helper="Skip it and Papa works it out as income minus spends and EMIs."
      />
      <View style={{ gap: spacing.sm }}>
        <QuestionLabel>When do you usually get paid?</QuestionLabel>
        <ChoiceCards options={SALARY_DAY_OPTIONS} selected={draft.salaryDay} onSelect={(value) => update({ salaryDay: value })} />
      </View>
    </View>
  );
}

export function SpendingStep({ draft, update }: StepProps) {
  return (
    <View style={{ gap: spacing.lg }}>
      <CurrencyField
        label="Monthly house rent"
        value={draft.rent}
        onChange={(value) => update({ rent: value })}
        placeholder="0 if you own or live with family"
      />
      <CurrencyField
        label="Everything else you spend monthly"
        value={draft.monthlyExpenses}
        onChange={(value) => update({ monthlyExpenses: value })}
        placeholder="Groceries, eating out, bills"
        helper="A rough monthly average is fine. Do not include rent or EMIs here."
      />
    </View>
  );
}

/**
 * Document-first entry: upload a bank statement (PDF/CSV/XLSX) and let the
 * backend suggest income/expense figures. Every suggested value is shown for
 * review and only applied when the user accepts it — autofill, not autopilot.
 */
function UploadCard({ draft, update }: StepProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [applied, setApplied] = useState(false);

  async function pickAndUpload() {
    setError(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "text/csv", "text/comma-separated-values", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.length) return;
    const asset = picked.assets[0];
    setBusy(true);
    setApplied(false);
    try {
      const result = await api.uploadDocument({
        uri: asset.uri,
        name: asset.name || "statement.pdf",
        mimeType: asset.mimeType || "application/pdf",
      });
      setAnalysis(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. You can always fill the fields by hand.");
    } finally {
      setBusy(false);
    }
  }

  function applyPatch() {
    if (!analysis) return;
    const patch = analysis.profilePatch || {};
    const next: Partial<OnboardingDraft> = {};
    if (patch.monthlySalary && !draft.monthlySalary) next.monthlySalary = patch.monthlySalary;
    if (patch.monthlyExpenses && !draft.monthlyExpenses) next.monthlyExpenses = patch.monthlyExpenses;
    if (patch.subscriptions) next.subscriptions = patch.subscriptions;
    if (patch.mutualFundsValue && !draft.mutualFundsValue) next.mutualFundsValue = patch.mutualFundsValue;
    update(next);
    setApplied(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  const usefulFields = analysis?.extractedFields?.filter((f) => Number(f.value) > 0) || [];

  return (
    <Card style={{ backgroundColor: colors.accent, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Sparkles color={colors.accentForeground} size={18} />
        <Text style={styles.uploadTitle}>Skip the typing</Text>
      </View>
      <Body size={13} style={{ color: colors.accentForeground }}>
        Upload a recent bank statement (PDF, CSV or XLSX) and Papa fills what he can. You check every number before it counts.
      </Body>

      {analysis && usefulFields.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          {usefulFields.map((field) => (
            <View key={field.field} style={styles.extractRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.extractLabel}>{field.label}</Text>
                <Text style={styles.extractStatus}>{field.status}</Text>
              </View>
              <Text style={styles.extractValue}>{formatINR(Number(field.value))}</Text>
            </View>
          ))}
          {applied ? (
            <Text style={styles.appliedNote}>Filled in below. Adjust anything that looks off.</Text>
          ) : (
            <PressableScale onPress={applyPatch} style={styles.applyBtn}>
              <Text style={styles.applyBtnText}>Use these numbers</Text>
            </PressableScale>
          )}
        </View>
      ) : analysis ? (
        <Text style={styles.extractStatus}>Papa could not read useful numbers from that file. Fill the fields below instead.</Text>
      ) : null}

      {error ? <Text style={styles.uploadError}>{error}</Text> : null}

      <PressableScale onPress={pickAndUpload} disabled={busy} style={[styles.uploadBtn, busy && { opacity: 0.6 }]}>
        {busy ? (
          <ActivityIndicator color={colors.accentForeground} size="small" />
        ) : (
          <FileUp color={colors.accentForeground} size={17} />
        )}
        <Text style={styles.uploadBtnText}>{busy ? "Papa is reading it" : analysis ? "Upload a different file" : "Upload a statement"}</Text>
      </PressableScale>
    </Card>
  );
}

const styles = StyleSheet.create({
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accentForeground,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.accentForeground,
  },
  uploadTitle: {
    fontSize: 15.5,
    fontWeight: "800",
    color: colors.accentForeground,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 999,
    paddingVertical: 12,
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.accentForeground,
  },
  uploadError: {
    fontSize: 12.5,
    color: colors.negativeForeground,
  },
  extractRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  extractLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.foreground,
  },
  extractStatus: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  extractValue: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.accentForeground,
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
  },
  applyBtnText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: "800",
  },
  appliedNote: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.accentForeground,
  },
});
