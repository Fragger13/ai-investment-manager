import { StyleSheet, Text, View } from "react-native";
import { Pencil } from "lucide-react-native";
import { Card, PressableScale } from "@/components/ui";
import { colors, spacing } from "@/constants/theme";
import { formatINR } from "@/lib/format";
import { GOAL_OPTIONS, ageFromDob, type OnboardingDraft, type StepId } from "./logic";

export function ReviewStep({ draft, jumpTo }: { draft: OnboardingDraft; jumpTo: (step: StepId) => void }) {
  const inflow = draft.monthlySalary + draft.otherIncome;
  const totalEmi = draft.emiLoans.reduce((sum, loan) => sum + loan.monthlyEmiAmount, 0);
  const goalNames = draft.goals
    .map((g) => {
      const label = g.type === "Other" ? g.customName : GOAL_OPTIONS.find((o) => o.value === g.type)?.label || g.type;
      return `${label} (${formatINR(g.targetAmount)})`;
    })
    .join(", ");

  return (
    <View style={{ gap: spacing.md }}>
      <ReviewCard title="You" onEdit={() => jumpTo("about")}>
        {draft.name}, {ageFromDob(draft.dateOfBirth)} · {draft.city} · {draft.occupation} · {draft.maritalStatus}
      </ReviewCard>
      <ReviewCard title="Money in" onEdit={() => jumpTo("income")}>
        {formatINR(inflow)} a month{draft.investableThisMonth > 0 ? ` · can invest ${formatINR(draft.investableThisMonth)} this month` : ""}
      </ReviewCard>
      <ReviewCard title="Money out" onEdit={() => jumpTo("spending")}>
        Rent {formatINR(draft.rent)} · Spends {formatINR(draft.monthlyExpenses)}
        {totalEmi > 0 ? ` · EMIs ${formatINR(totalEmi)}` : ""}
      </ReviewCard>
      <ReviewCard title="Loans" onEdit={() => jumpTo("loans")}>
        {draft.emiLoans.length > 0
          ? draft.emiLoans.map((l) => `${l.name} (${formatINR(l.monthlyEmiAmount)}/mo)`).join(", ")
          : "No loans right now"}
      </ReviewCard>
      <ReviewCard title="Risk comfort" onEdit={() => jumpTo("risk")}>
        {draft.drawdownTolerance === "0-10%" ? "Safety first" : draft.drawdownTolerance === "10-25%" ? "Patient" : "Long game"} ·
        invested for {draft.investmentHorizon} · retire at {draft.retirementAge}
      </ReviewCard>
      <ReviewCard title={`Goals (${draft.goals.length})`} onEdit={() => jumpTo("goals")}>
        {goalNames || "None yet"}
      </ReviewCard>
    </View>
  );
}

function ReviewCard({ title, children, onEdit }: { title: string; children: React.ReactNode; onEdit: () => void }) {
  return (
    <Card style={{ gap: 6 }}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <PressableScale onPress={onEdit} style={styles.editBtn}>
          <Pencil color={colors.primary} size={13} />
          <Text style={styles.editText}>Edit</Text>
        </PressableScale>
      </View>
      <Text style={styles.body}>{children}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
  },
  body: {
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.foreground,
  },
});
