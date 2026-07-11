import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { Check, ChevronDown, ChevronUp, FileUp, ShieldCheck } from "lucide-react-native";
import { Body, PressableScale } from "@/components/ui";
import { cardShadow, colors, radius, spacing } from "@/constants/theme";
import { api, ApiError, type DocumentAnalysis } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { OnboardingDraft } from "./logic";

type StepProps = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
};

type DocKey = "salary_slip" | "bank_statement" | "credit_card" | "loan_statement" | "portfolio";

const DOCUMENTS: { key: DocKey; emoji: string; title: string; fills: string }[] = [
  { key: "salary_slip", emoji: "💼", title: "Salary slip", fills: "Your in hand salary" },
  { key: "bank_statement", emoji: "🏦", title: "Bank account statement", fills: "Salary, spends, EMIs, subscriptions" },
  { key: "credit_card", emoji: "💳", title: "Credit card statement", fills: "Card spends and card EMIs" },
  { key: "loan_statement", emoji: "📄", title: "Loan or CIBIL statement", fills: "Your EMIs" },
  { key: "portfolio", emoji: "📈", title: "Portfolio or CAS statement", fills: "Mutual funds and investments" },
];

type DocDetails = {
  periodLabel?: string;
  totalMonthlySpend?: number;
  emis?: { name: string; amount: number }[];
  fieldNotes: { label: string; value: number; note: string }[];
};

type DocState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "done"; summary: string; details: DocDetails }
  | { phase: "empty" }
  | { phase: "error"; message: string };

/**
 * Documents-first onboarding: upload whatever paperwork exists, one document
 * at a time, and the later steps arrive prefilled for review. Every value can
 * still be edited by hand — documents fill fields, they never lock them.
 */
export function DocumentsStep({ draft, update }: StepProps) {
  const [states, setStates] = useState<Record<DocKey, DocState>>({
    salary_slip: { phase: "idle" },
    bank_statement: { phase: "idle" },
    credit_card: { phase: "idle" },
    loan_statement: { phase: "idle" },
    portfolio: { phase: "idle" },
  });
  const [expandedDoc, setExpandedDoc] = useState<DocKey | null>(null);

  const setState = (key: DocKey, state: DocState) => setStates((prev) => ({ ...prev, [key]: state }));

  async function pickAndUpload(key: DocKey) {
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "text/csv",
        "text/comma-separated-values",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.length) return;
    const asset = picked.assets[0];
    setState(key, { phase: "uploading" });
    try {
      const analysis = await api.uploadDocument(
        { uri: asset.uri, name: asset.name || "document.pdf", mimeType: asset.mimeType || "application/pdf" },
        key
      );
      const summary = applyPatch(key, analysis.profilePatch || {}, analysis);
      if (summary) {
        const statement = analysis.statement;
        const details: DocDetails = {
          periodLabel: statement?.periodLabel || undefined,
          totalMonthlySpend: statement?.totalMonthlySpend || undefined,
          emis: statement?.emiBreakdown?.map((item) => ({ name: item.name, amount: item.amount })),
          fieldNotes: (analysis.extractedFields || [])
            .filter((f) => Number(f.value) > 0)
            .map((f) => ({ label: f.label, value: Number(f.value), note: f.explanation })),
        };
        setState(key, { phase: "done", summary, details });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setState(key, { phase: "empty" });
      }
    } catch (e) {
      const message = e instanceof ApiError ? e.detail : "Something went wrong. Try again.";
      setState(key, { phase: "error", message });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  /** Apply extracted values into the draft; returns a human summary of what got filled. */
  function applyPatch(key: DocKey, patch: Record<string, number>, analysis?: DocumentAnalysis): string | null {
    const filled: string[] = [];
    const next: Partial<OnboardingDraft> = {};

    // Salary priority: the salary slip is authoritative. A statement's salary
    // guess only lands when no slip has filled the field.
    if (patch.monthlySalary && (key === "salary_slip" || !draft.monthlySalary)) {
      next.monthlySalary = patch.monthlySalary;
      filled.push(`salary ${formatINR(patch.monthlySalary)}`);
    }
    if (patch.rent && !draft.rent) {
      next.rent = patch.rent;
      filled.push(`rent ${formatINR(patch.rent)}`);
    }
    if (patch.monthlyExpenses && !draft.monthlyExpenses) {
      next.monthlyExpenses = patch.monthlyExpenses;
      filled.push(`spends ${formatINR(patch.monthlyExpenses)}`);
    }
    if (patch.subscriptions) {
      next.subscriptions = patch.subscriptions;
      filled.push(`subscriptions ${formatINR(patch.subscriptions)}`);
    }
    if (patch.mutualFundsValue && !draft.mutualFundsValue) {
      next.mutualFundsValue = patch.mutualFundsValue;
      filled.push(`investments ${formatINR(patch.mutualFundsValue)}`);
    }
    if (patch.emi) {
      next.emiHint = Math.max(patch.emi, draft.emiHint);
      filled.push(`EMIs ${formatINR(patch.emi)}/mo`);
    }
    const breakdown = analysis?.statement?.emiBreakdown;
    if (breakdown?.length) {
      next.emiBreakdown = breakdown.map((item) => ({ name: item.name, amount: item.amount }));
    }

    if (filled.length === 0) return null;
    update(next);
    return filled.join(" · ");
  }

  return (
    <View style={{ gap: spacing.md }}>
      {DOCUMENTS.map((doc) => {
        const state = states[doc.key];
        const done = state.phase === "done";
        const expanded = expandedDoc === doc.key && done;
        return (
          <View key={doc.key}>
            <PressableScale
              onPress={() => (state.phase === "uploading" ? undefined : pickAndUpload(doc.key))}
              style={[styles.card, done && styles.cardDone, done && styles.cardExpanded]}
            >
              <Text style={{ fontSize: 26 }}>{doc.emoji}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.title}>{doc.title}</Text>
                {state.phase === "done" ? (
                  <Text style={styles.doneText}>{state.summary}</Text>
                ) : state.phase === "empty" ? (
                  <Text style={styles.emptyText}>Papa could not read numbers from that file. Try another, or type it later.</Text>
                ) : state.phase === "error" ? (
                  <Text style={styles.errorText}>{state.message}</Text>
                ) : (
                  <Text style={styles.fills}>{doc.fills}</Text>
                )}
              </View>
              {state.phase === "uploading" ? (
                <ActivityIndicator color={colors.primary} />
              ) : done ? (
                <View style={styles.doneBadge}>
                  <Check color={colors.primaryForeground} size={14} strokeWidth={3} />
                </View>
              ) : (
                <View style={styles.uploadBadge}>
                  <FileUp color={colors.primary} size={16} />
                </View>
              )}
            </PressableScale>
            {done ? (
              <PressableScale
                haptic={false}
                onPress={() => setExpandedDoc(expanded ? null : doc.key)}
                style={styles.detailToggle}
              >
                <Text style={styles.detailToggleText}>{expanded ? "Hide what Papa read" : "See what Papa read"}</Text>
                {expanded ? (
                  <ChevronUp color={colors.accentForeground} size={14} />
                ) : (
                  <ChevronDown color={colors.accentForeground} size={14} />
                )}
              </PressableScale>
            ) : null}
            {expanded && state.phase === "done" ? <DocDetailPanel details={state.details} /> : null}
          </View>
        );
      })}

      <View style={styles.trustRow}>
        <ShieldCheck color={colors.positive} size={16} />
        <Body muted size={12} style={{ flex: 1 }}>
          Papa reads the numbers, you approve them on the next steps, and the file is stored encrypted. PDF, CSV and XLSX work.
        </Body>
      </View>
      <Body muted size={12.5}>
        No documents handy? Just continue and type things in. Every field stays editable either way.
      </Body>
    </View>
  );
}

function DocDetailPanel({ details }: { details: DocDetails }) {
  return (
    <View style={styles.detailPanel}>
      {details.periodLabel ? (
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Statement covers</Text>
          <Text style={styles.detailValue}>{details.periodLabel}</Text>
        </View>
      ) : null}
      {details.totalMonthlySpend ? (
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Average monthly spend (everything)</Text>
          <Text style={styles.detailValue}>{formatINR(details.totalMonthlySpend)}</Text>
        </View>
      ) : null}
      {details.emis?.length ? (
        <View style={{ gap: 4 }}>
          <Text style={styles.detailLabel}>EMIs, once per month each</Text>
          {details.emis.map((emi, i) => (
            <View key={i} style={styles.detailRow}>
              <Text style={styles.detailEmiName}>{emi.name}</Text>
              <Text style={styles.detailValue}>{formatINR(emi.amount)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {details.fieldNotes.map((note, i) => (
        <View key={i} style={{ gap: 1 }}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{note.label}</Text>
            <Text style={styles.detailValue}>{formatINR(note.value)}</Text>
          </View>
          <Text style={styles.detailNote}>{note.note}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
    ...cardShadow,
  },
  cardDone: {
    backgroundColor: colors.accent,
    borderColor: colors.primary,
  },
  cardExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  detailToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    backgroundColor: colors.accent,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    marginTop: -2,
  },
  detailToggleText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.accentForeground,
  },
  detailPanel: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.sm,
    ...cardShadow,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  detailLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.textSecondary,
    flexShrink: 1,
  },
  detailEmiName: {
    fontSize: 13,
    color: colors.foreground,
    flexShrink: 1,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.foreground,
  },
  detailNote: {
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.mutedForeground,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.foreground,
  },
  fills: {
    fontSize: 12.5,
    color: colors.mutedForeground,
  },
  doneText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.accentForeground,
  },
  emptyText: {
    fontSize: 12.5,
    color: colors.warningForeground,
  },
  errorText: {
    fontSize: 12.5,
    color: colors.negativeForeground,
  },
  uploadBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  doneBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
});
