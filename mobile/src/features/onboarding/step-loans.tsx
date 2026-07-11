import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Pencil, Plus, Trash2 } from "lucide-react-native";
import { Body, Button, PressableScale } from "@/components/ui";
import { cardShadow, colors, radius, spacing } from "@/constants/theme";
import { formatINR } from "@/lib/format";
import { CurrencyField, DateField, InputField, OptionChips, Sheet } from "./fields";
import { LOAN_TYPES, emptyLoan, monthsBetween, validLoan, type LoanDraft, type OnboardingDraft } from "./logic";

type StepProps = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
};

export function LoansStep({ draft, update }: StepProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [loanDraft, setLoanDraft] = useState<LoanDraft>(emptyLoan());

  const loans = draft.emiLoans;
  const noLoans = draft.hasEmiLoans === false;

  const openAdd = () => {
    setLoanDraft(emptyLoan());
    setEditIndex(null);
    setSheetOpen(true);
  };
  const openEdit = (index: number) => {
    setLoanDraft({ ...emptyLoan(), ...loans[index] });
    setEditIndex(index);
    setSheetOpen(true);
  };
  const saveLoan = () => {
    const next = editIndex !== null ? loans.map((l, i) => (i === editIndex ? loanDraft : l)) : [...loans, loanDraft];
    update({ emiLoans: next, hasEmiLoans: true });
    setSheetOpen(false);
  };
  const removeLoan = (index: number) => {
    const next = loans.filter((_, i) => i !== index);
    update({ emiLoans: next, hasEmiLoans: next.length > 0 ? true : draft.hasEmiLoans });
  };

  const months = monthsBetween(loanDraft.startDate, loanDraft.endDate);
  const totalAmount = loanDraft.monthlyEmiAmount > 0 && months > 0 ? loanDraft.monthlyEmiAmount * months : 0;

  return (
    <View style={{ gap: spacing.md }}>
      <PressableScale onPress={openAdd} style={[styles.bigChoice, draft.hasEmiLoans === true && styles.bigChoiceActive]}>
        <Text style={{ fontSize: 24 }}>💳</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.bigChoiceTitle}>Yes, I have loans or EMIs</Text>
          <Text style={styles.bigChoiceHelper}>
            {loans.length > 0 ? `${loans.length} added. Tap to add another.` : "Home, car, phone, cards. Tap to add one."}
          </Text>
        </View>
      </PressableScale>
      <PressableScale
        onPress={() => update({ hasEmiLoans: false, emiLoans: [] })}
        style={[styles.bigChoice, noLoans && styles.bigChoiceActive]}
      >
        <Text style={{ fontSize: 24 }}>🎉</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.bigChoiceTitle}>No loans right now</Text>
          <Text style={styles.bigChoiceHelper}>Financial freedom&apos;s favourite child.</Text>
        </View>
      </PressableScale>

      {loans.map((loan, index) => (
        <View key={index} style={styles.loanRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loanName}>{loan.name || loan.productType}</Text>
            <Text style={styles.loanMeta}>
              {loan.productType} · {formatINR(loan.monthlyEmiAmount)} a month
            </Text>
          </View>
          <PressableScale onPress={() => openEdit(index)} style={styles.iconBtn}>
            <Pencil color={colors.textSecondary} size={16} />
          </PressableScale>
          <PressableScale onPress={() => removeLoan(index)} style={styles.iconBtn}>
            <Trash2 color={colors.negativeForeground} size={16} />
          </PressableScale>
        </View>
      ))}

      {loans.length > 0 ? (
        <PressableScale onPress={openAdd} style={styles.addAnother}>
          <Plus color={colors.primary} size={16} />
          <Text style={styles.addAnotherText}>Add another loan</Text>
        </PressableScale>
      ) : null}

      <Body muted size={12}>
        Not sure where to look? CIBIL lists every loan on your PAN, and card EMIs show up in your credit card statement.
      </Body>

      <Sheet
        visible={sheetOpen}
        title={editIndex !== null ? "Edit loan" : "Add a loan"}
        onClose={() => setSheetOpen(false)}
        footer={
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title={editIndex !== null ? "Save loan" : "Add this loan"} onPress={saveLoan} disabled={!validLoan(loanDraft)} />
            <Button title="Cancel" variant="ghost" onPress={() => setSheetOpen(false)} />
          </View>
        }
      >
        <View style={{ gap: 7 }}>
          <Text style={styles.sheetLabel}>Loan or EMI type</Text>
          <OptionChips
            options={LOAN_TYPES.map((t) => ({ value: t, title: t }))}
            selected={loanDraft.productType}
            onSelect={(value) => setLoanDraft({ ...loanDraft, productType: value })}
          />
        </View>
        <InputField
          label="Name"
          value={loanDraft.name}
          onChangeText={(text) => setLoanDraft({ ...loanDraft, name: text })}
          placeholder="e.g., Car loan, iPhone EMI"
        />
        <CurrencyField
          label="Monthly EMI"
          value={loanDraft.monthlyEmiAmount}
          onChange={(value) => setLoanDraft({ ...loanDraft, monthlyEmiAmount: value })}
          placeholder="What you pay every month"
        />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <DateField
              label="Started"
              value={loanDraft.startDate}
              onChange={(iso) => setLoanDraft({ ...loanDraft, startDate: iso })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <DateField
              label="Ends"
              value={loanDraft.endDate}
              onChange={(iso) => setLoanDraft({ ...loanDraft, endDate: iso })}
            />
          </View>
        </View>
        {totalAmount > 0 ? (
          <Body muted size={12.5}>
            {months} months × {formatINR(loanDraft.monthlyEmiAmount)} = {formatINR(totalAmount)} total
          </Body>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  bigChoice: {
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
  bigChoiceActive: {
    backgroundColor: colors.accent,
    borderColor: colors.primary,
  },
  bigChoiceTitle: {
    fontSize: 15.5,
    fontWeight: "800",
    color: colors.foreground,
  },
  bigChoiceHelper: {
    fontSize: 12.5,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  loanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    ...cardShadow,
  },
  loanName: {
    fontSize: 14.5,
    fontWeight: "700",
    color: colors.foreground,
  },
  loanMeta: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  addAnother: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  addAnotherText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primary,
  },
  sheetLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
});
