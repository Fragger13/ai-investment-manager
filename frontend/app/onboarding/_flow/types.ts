import { FieldPath, UseFormReturn } from "react-hook-form";
import { ReactNode } from "react";
import { OnboardingProfile } from "@/types";

export type SectionId =
  | "welcome"
  | "about"
  | "income"
  | "spending"
  | "loans"
  | "assets"
  | "risk"
  | "habits"
  | "goals"
  | "celebrate";

export type SectionDef = { id: SectionId; label: string };

export type ScreenContext = {
  form: UseFormReturn<OnboardingProfile>;
  values: OnboardingProfile;
  next: () => Promise<void>;
  back: () => void;
};

export type ScreenDef = {
  id: string;
  sectionId: SectionId;
  fields?: FieldPath<OnboardingProfile>[];
  shouldSkip?: (values: OnboardingProfile) => boolean;
  render: (ctx: ScreenContext) => ReactNode;
  nextLabel?: string;
  hideShellChrome?: boolean;
};

export const SECTIONS: SectionDef[] = [
  { id: "welcome", label: "Welcome" },
  { id: "about", label: "About you" },
  { id: "income", label: "Income" },
  { id: "spending", label: "Spending" },
  { id: "loans", label: "Loans" },
  { id: "assets", label: "Assets" },
  { id: "risk", label: "Risk" },
  { id: "habits", label: "Habits" },
  { id: "goals", label: "Goals" },
  { id: "celebrate", label: "Done" }
];
