"use client";

import { PapaAvatar } from "../_components/papa-bubble";
import { SCRIPT_FAMILY, SCRIPT_GREEN } from "@/lib/fonts";
import { useAuthStore } from "@/store/auth-store";
import { ScreenContext } from "../_flow/types";

export function WelcomeScreen(_ctx: ScreenContext) {
  const user = useAuthStore((state) => state.user);
  const firstName = (user?.name || "").trim().split(/\s+/)[0] || "";
  return (
    <div className="flex flex-col items-center text-center">
      <PapaAvatar
        avatarClass="h-24 w-24"
        mood="warm"
        ringClass="ring-4 ring-white shadow-md"
      />
      <p className="mt-5 text-sm font-medium uppercase tracking-wide text-[#138A3C]">A note from Papa</p>
      <h1
        className="mt-2 text-[2.5rem] leading-[1.05] sm:text-[3.25rem]"
        style={{ fontFamily: SCRIPT_FAMILY, color: SCRIPT_GREEN }}
      >
        Hi Bacche!
      </h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-[#4B5563]">
        Five minutes{firstName ? `, ${firstName}` : ""}. You have spent longer deciding what to watch on Netflix.
      </p>
      <div className="mt-6 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-3">
        <WelcomePill icon="⏱️" label="5 minutes" />
        <WelcomePill icon="💾" label="Auto-saved" />
        <WelcomePill icon="☕" label="Pause anytime" />
      </div>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#E9F4EC] px-4 py-1.5 text-xs font-semibold text-[#138A3C]">
        🔒 Encrypted end to end
      </div>
      <p className="mt-2 max-w-sm text-xs leading-5 text-[#6B7280]">
        Your money details are locked with your password before they are saved. Nobody else can read them, not even the team behind AskPapa.
      </p>
    </div>
  );
}

function WelcomePill({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] shadow-sm">
      <span aria-hidden>{icon}</span>
      {label}
    </div>
  );
}
