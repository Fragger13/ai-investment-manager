import { useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as IntentLauncher from "expo-intent-launcher";
import { Check, ExternalLink, FileUp, KeyRound, ShieldCheck, Smartphone } from "lucide-react-native";
import { Body, PressableScale } from "@/components/ui";
import { cardShadow, colors, radius, spacing } from "@/constants/theme";
import { api, ApiError, type DocumentAnalysis } from "@/lib/api";
import { Sheet } from "./fields";
import type { OnboardingDraft } from "./logic";

type StepProps = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
};

// Kept deliberately minimal: the bank statement already carries salary and
// EMIs, so no separate salary slip or loan statement uploads.
type DocKey = "bank_statement" | "credit_card" | "portfolio";

const DOCUMENTS: { key: DocKey; emoji: string; title: string; fills: string }[] = [
  { key: "bank_statement", emoji: "🏦", title: "Bank account statement", fills: "Salary, spends and EMIs" },
  { key: "credit_card", emoji: "💳", title: "Credit card statement", fills: "Card spends and card EMIs" },
  { key: "portfolio", emoji: "📈", title: "Portfolio or CAS statement", fills: "Mutual funds and investments" },
];

// Launchable Android apps where statements live. Opening one is a shortcut,
// not an integration: the user downloads the PDF there and uploads it here.
const BANK_APPS: { name: string; pkg: string }[] = [
  { name: "HDFC Bank", pkg: "com.snapwork.hdfc" },
  { name: "SBI YONO", pkg: "com.sbi.lotusintouch" },
  { name: "ICICI iMobile", pkg: "com.csam.icici.bank.imobile" },
  { name: "Axis Mobile", pkg: "com.axis.mobile" },
  { name: "Kotak Mobile Banking", pkg: "com.msf.kbank.mobile" },
  { name: "IDFC FIRST Bank", pkg: "com.idfcfirstbank.optimus" },
  { name: "PNB ONE", pkg: "com.Version1" },
  { name: "bob World", pkg: "com.bankofbaroda.mconnect" },
  { name: "IndusMobile", pkg: "com.fss.indus" },
  { name: "FedMobile", pkg: "com.fedmobile" },
];
const CRED_APP = { name: "CRED", pkg: "com.dreamplug.androidapp" };

type PickedFile = { uri: string; name: string; mimeType: string };

type DocState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "done" }
  | { phase: "empty" }
  | { phase: "error"; message: string }
  // The PDF is locked; keep the picked file so the retry with a password
  // doesn't make the user pick it again.
  | { phase: "password"; file: PickedFile; message: string };

/**
 * Documents-first onboarding: upload whatever paperwork exists, one document
 * at a time, and the later steps arrive prefilled for review. The card only
 * confirms the read; the numbers themselves show up in their own sections,
 * where the user can check and edit them.
 */
export function DocumentsStep({ draft, update }: StepProps) {
  const [states, setStates] = useState<Record<DocKey, DocState>>({
    bank_statement: { phase: "idle" },
    credit_card: { phase: "idle" },
    portfolio: { phase: "idle" },
  });
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [bankSheetFor, setBankSheetFor] = useState<DocKey | null>(null);
  const [openFailed, setOpenFailed] = useState<string | null>(null);

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
    await upload(key, {
      uri: asset.uri,
      name: asset.name || "document.pdf",
      mimeType: asset.mimeType || "application/pdf",
    });
  }

  async function upload(key: DocKey, file: PickedFile, password?: string) {
    setState(key, { phase: "uploading" });
    try {
      const analysis = await api.uploadDocument(file, key, password);
      if (applyPatch(analysis.profilePatch || {}, analysis)) {
        setState(key, { phase: "done" });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setState(key, { phase: "empty" });
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.detail.includes("pdf_password_required")) {
        setState(key, {
          phase: "password",
          file,
          message: password
            ? "That password did not open the file. Check it and try again."
            : "This PDF is locked. Enter the password from your bank, it is usually in the statement email.",
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      const message = e instanceof ApiError ? e.detail : "Something went wrong. Try again.";
      setState(key, { phase: "error", message });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  /** Apply extracted values into the draft; returns whether anything filled. */
  function applyPatch(patch: Record<string, number>, analysis?: DocumentAnalysis): boolean {
    const next: Partial<OnboardingDraft> = {};

    // A later upload never overwrites a value that is already filled.
    if (patch.monthlySalary && !draft.monthlySalary) next.monthlySalary = patch.monthlySalary;
    if (patch.rent && !draft.rent) next.rent = patch.rent;
    if (patch.monthlyExpenses && !draft.monthlyExpenses) next.monthlyExpenses = patch.monthlyExpenses;
    if (patch.subscriptions) next.subscriptions = patch.subscriptions;
    if (patch.mutualFundsValue && !draft.mutualFundsValue) next.mutualFundsValue = patch.mutualFundsValue;
    if (patch.emi) next.emiHint = Math.max(patch.emi, draft.emiHint);
    const breakdown = analysis?.statement?.emiBreakdown;
    if (breakdown?.length) {
      next.emiBreakdown = breakdown.map((item) => ({ name: item.name, amount: item.amount }));
    }

    if (Object.keys(next).length === 0) return false;
    update(next);
    return true;
  }

  async function openApp(name: string, pkg: string) {
    setOpenFailed(null);
    try {
      await IntentLauncher.openApplication(pkg);
    } catch {
      setOpenFailed(name);
    }
  }

  return (
    <View style={{ gap: spacing.md }}>
      {DOCUMENTS.map((doc) => {
        const state = states[doc.key];
        const done = state.phase === "done";
        const showBankLink =
          Platform.OS === "android" &&
          (doc.key === "bank_statement" || doc.key === "credit_card") &&
          state.phase === "idle";
        return (
          <View key={doc.key}>
            <PressableScale
              onPress={() => (state.phase === "uploading" ? undefined : pickAndUpload(doc.key))}
              style={[styles.card, done && styles.cardDone]}
            >
              <Text style={{ fontSize: 26 }}>{doc.emoji}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.title}>{doc.title}</Text>
                {state.phase === "done" ? (
                  <Text style={styles.doneText}>Read it. These details will arrive prefilled in the next steps.</Text>
                ) : state.phase === "empty" ? (
                  <Text style={styles.emptyText}>Papa could not read numbers from that file. Try another, or type it later.</Text>
                ) : state.phase === "error" ? (
                  <Text style={styles.errorText}>{state.message}</Text>
                ) : state.phase === "password" ? (
                  <Text style={styles.emptyText}>{state.message}</Text>
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
            {showBankLink ? (
              <PressableScale haptic={false} onPress={() => setBankSheetFor(doc.key)} style={styles.bankLink}>
                <Smartphone color={colors.primary} size={14} />
                <Text style={styles.bankLinkText}>
                  {doc.key === "credit_card" ? "No PDF handy? Open your bank or CRED app" : "No PDF handy? Open your bank app"}
                </Text>
              </PressableScale>
            ) : null}
            {state.phase === "password" ? (
              <View style={styles.passwordPanel}>
                <TextInput
                  style={styles.passwordInput}
                  value={passwordDrafts[doc.key] || ""}
                  onChangeText={(text) => setPasswordDrafts((prev) => ({ ...prev, [doc.key]: text }))}
                  placeholder="PDF password"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={() => {
                    const pw = (passwordDrafts[doc.key] || "").trim();
                    if (pw) upload(doc.key, state.file, pw);
                  }}
                />
                <PressableScale
                  onPress={() => {
                    const pw = (passwordDrafts[doc.key] || "").trim();
                    if (pw) upload(doc.key, state.file, pw);
                  }}
                  style={styles.passwordBtn}
                >
                  <KeyRound color={colors.primaryForeground} size={15} />
                  <Text style={styles.passwordBtnText}>Unlock</Text>
                </PressableScale>
              </View>
            ) : null}
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

      <Sheet
        visible={bankSheetFor !== null}
        title="Get your statement"
        onClose={() => {
          setBankSheetFor(null);
          setOpenFailed(null);
        }}
      >
        <Body muted size={12.5}>
          Open your app and download the statement PDF, it usually lives under Accounts or Statements. Then come back here and upload it.
        </Body>
        {openFailed ? (
          <Text style={styles.bankFail}>Papa could not open {openFailed}. Open it from your home screen instead.</Text>
        ) : null}
        {(bankSheetFor === "credit_card" ? [CRED_APP, ...BANK_APPS] : BANK_APPS).map((app) => (
          <PressableScale key={app.pkg} onPress={() => openApp(app.name, app.pkg)} style={styles.bankRow}>
            <Text style={styles.bankName}>{app.name}</Text>
            <ExternalLink color={colors.primary} size={15} />
          </PressableScale>
        ))}
      </Sheet>
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
  bankLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
  },
  bankLinkText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.primary,
  },
  bankRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  bankName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.foreground,
  },
  bankFail: {
    fontSize: 12.5,
    color: colors.warningForeground,
  },
  passwordPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
    marginTop: spacing.sm,
    ...cardShadow,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: colors.foreground,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  passwordBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  passwordBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primaryForeground,
  },
});
