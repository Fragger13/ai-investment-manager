import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { Body, Button, PressableScale } from "@/components/ui";
import { cardShadow, colors, radius, spacing } from "@/constants/theme";
import { formatINRCompact } from "@/lib/format";
import { CurrencyField, DateField, InputField, QuestionLabel, Sheet } from "./fields";
import { GOAL_OPTIONS, emptyGoal, type GoalDraft, type OnboardingDraft } from "./logic";

type StepProps = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
};

export function GoalsStep({ draft, update }: StepProps) {
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [goalDraft, setGoalDraft] = useState<GoalDraft | null>(null);
  const [isNew, setIsNew] = useState(false);

  const goals = draft.goals;

  const openForType = (type: string) => {
    const existing = goals.findIndex((g) => g.type === type);
    if (existing >= 0) {
      setGoalDraft({ ...goals[existing] });
      setEditIndex(existing);
      setIsNew(false);
    } else {
      setGoalDraft(emptyGoal(type, goals.length + 1));
      setEditIndex(null);
      setIsNew(true);
    }
  };

  const saveGoal = () => {
    if (!goalDraft) return;
    const next = editIndex !== null ? goals.map((g, i) => (i === editIndex ? goalDraft : g)) : [...goals, goalDraft];
    update({ goals: next });
    setGoalDraft(null);
  };

  const removeGoal = (type: string) => {
    update({ goals: goals.filter((g) => g.type !== type) });
  };

  const goalValid = Boolean(
    goalDraft &&
      goalDraft.targetAmount > 0 &&
      (goalDraft.type !== "Other" || goalDraft.customName.trim()) &&
      (goalDraft.paymentStyle !== "emi" || goalDraft.tenureYears >= 1)
  );

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.grid}>
        {GOAL_OPTIONS.map((option) => {
          const goal = goals.find((g) => g.type === option.value);
          const filled = Boolean(goal);
          return (
            <View key={option.value} style={styles.tileWrap}>
              <PressableScale onPress={() => openForType(option.value)} style={[styles.tile, filled && styles.tileActive]}>
                <Text style={{ fontSize: 30 }}>{option.emoji}</Text>
                <Text style={styles.tileLabel}>{option.label}</Text>
                {filled && goal && goal.targetAmount > 0 ? (
                  <Text style={styles.tileAmount}>{formatINRCompact(goal.targetAmount)}</Text>
                ) : null}
                {filled ? (
                  <View style={styles.tick}>
                    <Check color={colors.primaryForeground} size={11} strokeWidth={3.2} />
                  </View>
                ) : null}
              </PressableScale>
              {filled ? (
                <PressableScale onPress={() => removeGoal(option.value)} style={styles.removeBtn} haptic={false}>
                  <X color={colors.textSecondary} size={12} strokeWidth={3} />
                </PressableScale>
              ) : null}
            </View>
          );
        })}
      </View>
      <Body muted size={12.5}>
        {goals.length === 0
          ? "Tap a goal to plan it. Pick at least one, add as many as you like."
          : `${goals.length} goal${goals.length > 1 ? "s" : ""} planned. Tap a tile to edit.`}
      </Body>

      <Sheet
        visible={goalDraft !== null}
        title={goalDraft ? `Plan: ${goalDraft.type === "Other" ? goalDraft.customName || "Something else" : goalDraft.type}` : ""}
        onClose={() => setGoalDraft(null)}
        footer={
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title={isNew ? "Add this goal" : "Save changes"} onPress={saveGoal} disabled={!goalValid} />
            <Button title={isNew ? "Discard" : "Cancel"} variant="ghost" onPress={() => setGoalDraft(null)} />
          </View>
        }
      >
        {goalDraft ? (
          <>
            {goalDraft.type === "Other" ? (
              <InputField
                label="What are you saving for?"
                value={goalDraft.customName}
                onChangeText={(text) => setGoalDraft({ ...goalDraft, customName: text })}
                placeholder="e.g., Goa trip, new laptop"
              />
            ) : null}
            <CurrencyField
              label="Target amount"
              value={goalDraft.targetAmount}
              onChange={(value) => setGoalDraft({ ...goalDraft, targetAmount: value })}
              placeholder="How much will you need?"
              helper="In today's money. A rough figure is fine, you can adjust later."
            />
            <CurrencyField
              label="Already saved for this"
              value={goalDraft.currentAmount}
              onChange={(value) => setGoalDraft({ ...goalDraft, currentAmount: value })}
              placeholder="0 if just starting"
              optional
            />
            <DateField
              label="When do you want it?"
              value={goalDraft.targetDate}
              onChange={(iso) => setGoalDraft({ ...goalDraft, targetDate: iso })}
              minimumDate={new Date()}
              placeholder="Rough target date"
            />
            <View style={{ gap: spacing.sm }}>
              <QuestionLabel>How will you fund it?</QuestionLabel>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <FundChip
                  emoji="🐢"
                  title="Save up over time"
                  active={goalDraft.paymentStyle === "lumpsum"}
                  onPress={() => setGoalDraft({ ...goalDraft, paymentStyle: "lumpsum" })}
                />
                <FundChip
                  emoji="🏦"
                  title="Loan with EMI"
                  active={goalDraft.paymentStyle === "emi"}
                  onPress={() => setGoalDraft({ ...goalDraft, paymentStyle: "emi" })}
                />
              </View>
            </View>
            {goalDraft.paymentStyle === "emi" ? (
              <View style={{ gap: spacing.lg }}>
                <CurrencyField
                  label="Down payment"
                  value={goalDraft.downPayment}
                  onChange={(value) => setGoalDraft({ ...goalDraft, downPayment: value })}
                  placeholder="Cash you'll pay upfront"
                />
                <View style={{ flexDirection: "row", gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <SmallNumberField
                      label="Loan rate %"
                      value={goalDraft.interestRate}
                      onChange={(value) => setGoalDraft({ ...goalDraft, interestRate: value })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <SmallNumberField
                      label="Tenure (years)"
                      value={goalDraft.tenureYears}
                      onChange={(value) => setGoalDraft({ ...goalDraft, tenureYears: Math.round(value) })}
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

function FundChip({ emoji, title, active, onPress }: { emoji: string; title: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={[styles.fundChip, active && styles.fundChipActive]}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text style={[styles.fundChipText, active && { color: colors.accentForeground }]}>{title}</Text>
    </PressableScale>
  );
}

function SmallNumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.smallLabel}>{label}</Text>
      <TextInput
        value={value ? String(value) : ""}
        onChangeText={(text) => onChange(Number(text.replace(/[^0-9.]/g, "")) || 0)}
        keyboardType="decimal-pad"
        placeholderTextColor={"hsl(222, 12%, 62%)"}
        style={styles.smallInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tileWrap: {
    width: "31%",
    flexGrow: 1,
    maxWidth: "32%",
  },
  tile: {
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: 6,
    borderWidth: 1.5,
    borderColor: "transparent",
    minHeight: 104,
    justifyContent: "center",
    ...cardShadow,
  },
  tileActive: {
    backgroundColor: colors.accent,
    borderColor: colors.primary,
  },
  tileLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
  },
  tileAmount: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.accentForeground,
  },
  tick: {
    position: "absolute",
    left: 8,
    top: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  fundChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: "transparent",
    ...cardShadow,
  },
  fundChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.primary,
  },
  fundChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.foreground,
  },
  smallLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  smallInput: {
    borderWidth: 1.5,
    borderColor: "transparent",
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: "hsl(36, 45%, 93%)",
  },
});
