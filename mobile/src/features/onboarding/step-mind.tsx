import { StyleSheet, Text, TextInput, View } from "react-native";
import { spacing, colors, radius } from "@/constants/theme";
import { MultiChips, OptionChips, QuestionLabel } from "./fields";
import {
  BLOCKER_QUESTION,
  DRAWDOWN_QUESTION,
  HABIT_QUESTIONS,
  HORIZON_QUESTION,
  MULTI_SEP,
  NO_BLOCKER,
  type OnboardingDraft,
} from "./logic";

type StepProps = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
};

export function RiskStep({ draft, update }: StepProps) {
  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ gap: spacing.sm }}>
        <QuestionLabel>{DRAWDOWN_QUESTION.question}</QuestionLabel>
        <OptionChips
          options={DRAWDOWN_QUESTION.options}
          selected={draft.drawdownTolerance}
          onSelect={(value) => update({ drawdownTolerance: value })}
        />
      </View>
      <View style={{ gap: spacing.sm }}>
        <QuestionLabel>{HORIZON_QUESTION.question}</QuestionLabel>
        <OptionChips
          options={HORIZON_QUESTION.options}
          selected={draft.investmentHorizon}
          onSelect={(value) => update({ investmentHorizon: value })}
        />
      </View>
      <View style={{ gap: spacing.sm }}>
        <QuestionLabel>When would you like to retire?</QuestionLabel>
        <View style={styles.retireRow}>
          <TextInput
            value={draft.retirementAge ? String(draft.retirementAge) : ""}
            onChangeText={(text) => update({ retirementAge: Number(text.replace(/[^0-9]/g, "")) || 0 })}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="60"
            placeholderTextColor={"hsl(222, 12%, 62%)"}
            style={styles.retireInput}
          />
          <Text style={styles.retireHint}>Most people pick around 60. Earlier is fine if that is the dream.</Text>
        </View>
      </View>
    </View>
  );
}

const parseMulti = (value: string): string[] => (value ? value.split(MULTI_SEP).filter(Boolean) : []);

export function HabitsStep({ draft, update }: StepProps) {
  // "Nothing right now" is mutually exclusive with the real blockers; stored as
  // a ", "-joined string exactly like the web (backend expects a plain string).
  const toggleBlocker = (value: string) => {
    const current = parseMulti(draft.investingBlocker);
    let next: string[];
    if (value === NO_BLOCKER) {
      next = current.includes(NO_BLOCKER) ? [] : [NO_BLOCKER];
    } else {
      const withoutNone = current.filter((v) => v !== NO_BLOCKER);
      next = withoutNone.includes(value) ? withoutNone.filter((v) => v !== value) : [...withoutNone, value];
    }
    update({ investingBlocker: next.join(MULTI_SEP) });
  };

  return (
    <View style={{ gap: spacing.xl }}>
      {HABIT_QUESTIONS.map((q) => (
        <View key={q.field} style={{ gap: spacing.sm }}>
          <QuestionLabel>{q.question}</QuestionLabel>
          <OptionChips options={q.options} selected={draft[q.field]} onSelect={(value) => update({ [q.field]: value })} />
        </View>
      ))}
      <View style={{ gap: spacing.sm }}>
        <QuestionLabel note={BLOCKER_QUESTION.note}>{BLOCKER_QUESTION.question}</QuestionLabel>
        <MultiChips options={BLOCKER_QUESTION.options} selected={parseMulti(draft.investingBlocker)} onToggle={toggleBlocker} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  retireRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  retireInput: {
    width: 88,
    borderWidth: 1.5,
    borderColor: "transparent",
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    color: colors.foreground,
    backgroundColor: "hsl(36, 45%, 93%)",
  },
  retireHint: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
});
