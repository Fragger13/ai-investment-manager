import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { CalendarDays } from "lucide-react-native";
import { PressableScale } from "@/components/ui";
import { cardShadow, colors, radius, spacing } from "@/constants/theme";
import { formatINRInput, parseINRInput } from "./logic";

const PLACEHOLDER = "hsl(222, 12%, 62%)";

export function QuestionLabel({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <Text style={styles.questionLabel}>
      {children}
      {note ? <Text style={styles.questionNote}>  {note}</Text> : null}
    </Text>
  );
}

/** Filled text input with label, same visual language as the login fields. */
export function InputField(props: TextInputProps & { label: string; optional?: boolean }) {
  const { label, optional, ...rest } = props;
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.fieldLabel}>
        {label}
        {optional ? <Text style={styles.optional}>  optional</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={PLACEHOLDER}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && styles.inputFocused]}
        {...rest}
      />
    </View>
  );
}

/** ₹ input with live Indian digit grouping. Value in/out is a plain number. */
export function CurrencyField({
  label,
  value,
  onChange,
  placeholder,
  helper,
  optional,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  helper?: string;
  optional?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.fieldLabel}>
        {label}
        {optional ? <Text style={styles.optional}>  optional</Text> : null}
      </Text>
      <View style={[styles.input, styles.currencyWrap, focused && styles.inputFocused]}>
        <Text style={styles.rupee}>₹</Text>
        <TextInput
          value={formatINRInput(value)}
          onChangeText={(text) => onChange(parseINRInput(text))}
          keyboardType="number-pad"
          placeholder={placeholder || "0"}
          placeholderTextColor={PLACEHOLDER}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.currencyInput}
        />
      </View>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

/** Tappable date field backed by the native date picker. Value is YYYY-MM-DD. */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder = "Pick a date",
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const date = value ? new Date(value) : new Date();

  const display = value
    ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";

  function open() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: Number.isNaN(date.getTime()) ? new Date() : date,
        mode: "date",
        minimumDate,
        maximumDate,
        onChange: (event, selected) => {
          if (event.type === "set" && selected) onChange(selected.toISOString().slice(0, 10));
        },
      });
    } else {
      setIosOpen(true);
    }
  }

  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={open} style={[styles.input, styles.dateWrap]}>
        <Text style={display ? styles.dateText : styles.datePlaceholder}>{display || placeholder}</Text>
        <CalendarDays color={colors.mutedForeground} size={18} />
      </Pressable>
      {iosOpen ? (
        <DateTimePicker
          value={Number.isNaN(date.getTime()) ? new Date() : date}
          mode="date"
          display="spinner"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, selected) => {
            setIosOpen(false);
            if (selected) onChange(selected.toISOString().slice(0, 10));
          }}
        />
      ) : null}
    </View>
  );
}

/** Wrapping row of single-select chips. */
export function OptionChips({
  options,
  selected,
  onSelect,
}: {
  options: { value: string; title: string; emoji?: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = selected === option.value;
        return (
          <PressableScale
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            {option.emoji ? <Text style={{ fontSize: 15 }}>{option.emoji}</Text> : null}
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.title}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Wrapping row of multi-select chips (selected is an array of values). */
export function MultiChips({
  options,
  selected,
  onToggle,
}: {
  options: { value: string; title: string; emoji?: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <PressableScale
            key={option.value}
            onPress={() => onToggle(option.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            {option.emoji ? <Text style={{ fontSize: 15 }}>{option.emoji}</Text> : null}
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.title}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Larger tappable cards with a helper line (family status, salary day). */
export function ChoiceCards({
  options,
  selected,
  onSelect,
}: {
  options: { value: string; emoji: string; helper: string; title?: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      {options.map((option) => {
        const active = selected === option.value;
        return (
          <PressableScale
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={[styles.choiceCard, active && styles.choiceCardActive]}
          >
            <Text style={{ fontSize: 24 }}>{option.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.choiceTitle}>{option.title || option.value}</Text>
              <Text style={styles.choiceHelper}>{option.helper}</Text>
            </View>
            <View style={[styles.radio, active && styles.radioActive]}>
              {active ? <View style={styles.radioDot} /> : null}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Bottom sheet modal for sub-flows (add loan, plan goal). */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.md }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  questionLabel: {
    fontSize: 15.5,
    fontWeight: "700",
    color: colors.foreground,
    lineHeight: 22,
  },
  questionNote: {
    fontSize: 12.5,
    fontWeight: "500",
    color: colors.mutedForeground,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  optional: {
    fontSize: 11.5,
    fontWeight: "500",
    color: colors.mutedForeground,
  },
  input: {
    borderWidth: 1.5,
    borderColor: "transparent",
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.foreground,
    backgroundColor: "hsl(36, 45%, 93%)",
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  helper: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.mutedForeground,
  },
  currencyWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 0,
  },
  rupee: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.mutedForeground,
  },
  currencyInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.foreground,
  },
  dateWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: {
    fontSize: 16,
    color: colors.foreground,
  },
  datePlaceholder: {
    fontSize: 16,
    color: PLACEHOLDER,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "transparent",
    ...cardShadow,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.foreground,
  },
  chipTextActive: {
    color: colors.accentForeground,
    fontWeight: "800",
  },
  choiceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    ...cardShadow,
  },
  choiceCardActive: {
    backgroundColor: colors.accent,
    borderColor: colors.primary,
  },
  choiceTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.foreground,
  },
  choiceHelper: {
    fontSize: 12.5,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius["3xl"],
    borderTopRightRadius: radius["3xl"],
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: "88%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.foreground,
    letterSpacing: -0.3,
    marginBottom: spacing.lg,
  },
});
