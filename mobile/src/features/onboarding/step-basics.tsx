import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "@/constants/theme";
import { ChoiceCards, CurrencyField, DateField, InputField, QuestionLabel } from "./fields";
import { FAMILY_OPTIONS, SALARY_DAY_OPTIONS, formatINRInput, type OnboardingDraft } from "./logic";

type StepProps = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
};

export function AboutStep({ draft, update }: StepProps) {
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
});
