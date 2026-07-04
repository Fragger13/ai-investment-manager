import { OnboardingProfile } from "@/types";
import { ScreenDef } from "./types";
import { WelcomeScreen } from "../_screens/welcome";
import { AboutScreen } from "../_screens/about";
import { IncomeScreen } from "../_screens/income";
import { SpendingScreen, LoansScreen } from "../_screens/expenses";
import {
  AssetsIntroScreen,
  AssetsUploadScreen,
  AssetsManualScreen,
} from "../_screens/assets";
import { RiskScreen } from "../_screens/risk";
import { HabitsScreen } from "../_screens/habits";
import { GoalsScreen } from "../_screens/goals";
import { CelebrateScreen } from "../_screens/celebrate";

export function buildScreens(
  _values: OnboardingProfile,
  options: { skipWelcome?: boolean; skipCelebrate?: boolean; goalsOnly?: boolean } = {}
): ScreenDef[] {
  const screens: ScreenDef[] = [];

  if (options.goalsOnly) {
    screens.push({
      id: "goals",
      sectionId: "goals",
      render: GoalsScreen,
      nextLabel: "Save goals"
    });
    return screens;
  }

  if (!options.skipWelcome) {
    screens.push({
      id: "welcome",
      sectionId: "welcome",
      render: WelcomeScreen,
      nextLabel: "Let's begin"
    });
  }

  screens.push({
    id: "about",
    sectionId: "about",
    fields: ["name", "dateOfBirth", "city", "occupation", "maritalStatus"],
    render: AboutScreen
  });

  screens.push({
    id: "income",
    sectionId: "income",
    fields: ["monthlySalary", "otherIncome", "investableThisMonth", "salaryDay"],
    render: IncomeScreen
  });

  screens.push({
    id: "spending",
    sectionId: "spending",
    fields: ["rent", "monthlyExpenses"],
    render: SpendingScreen
  });

  screens.push({
    id: "loans",
    sectionId: "loans",
    fields: ["emiLoans", "hasEmiLoans"],
    render: LoansScreen
  });

  // Assets flow: Intro picks "upload" or "manual" intent.
  //   • Upload path → single Upload screen (upload box + portfolio buckets inline)
  //   • Manual path → single Manual screen (lumpsum entry)
  const assetsIntent = (): "upload" | "manual" | null => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem("askpapa_assets_intent");
    return v === "upload" || v === "manual" ? v : null;
  };

  screens.push({
    id: "assets-intro",
    sectionId: "assets",
    render: AssetsIntroScreen,
  });

  screens.push({
    id: "assets-upload",
    sectionId: "assets",
    render: AssetsUploadScreen,
    shouldSkip: () => assetsIntent() === "manual",
  });

  screens.push({
    id: "assets-manual",
    sectionId: "assets",
    render: AssetsManualScreen,
    shouldSkip: () => assetsIntent() !== "manual",
  });

  screens.push({
    id: "risk",
    sectionId: "risk",
    // Only the two questions the user actually answers are validated here; the
    // finer-grained risk fields (loss tolerance, short-term horizon, opportunity
    // preference, volatility comfort) are derived from these in RiskScreen /
    // onboarding page and validated at final submit.
    fields: ["drawdownTolerance", "investmentHorizon", "retirementAge"],
    render: RiskScreen
  });

  screens.push({
    id: "habits",
    sectionId: "habits",
    fields: [
      "spendingDiscipline",
      "emotionalSpendingTendency",
      "tracksExpenses",
      "investsMonthly",
      "investmentPsychology",
      "panicSellRisk",
      "investingBlocker"
    ],
    render: HabitsScreen
  });

  screens.push({
    id: "goals",
    sectionId: "goals",
    render: GoalsScreen
  });

  if (!options.skipCelebrate) {
    screens.push({
      id: "celebrate",
      sectionId: "celebrate",
      render: CelebrateScreen,
      nextLabel: "Open my dashboard",
      hideShellChrome: true
    });
  }

  return screens;
}
