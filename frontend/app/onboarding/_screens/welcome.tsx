"use client";

import { Sparkles } from "lucide-react";
import { PapaAvatar } from "../_components/papa-bubble";
import { SCRIPT_FAMILY, SCRIPT_GREEN } from "@/lib/fonts";
import { ScreenContext } from "../_flow/types";

export function WelcomeScreen(_ctx: ScreenContext) {
  return (
    <div className="flex flex-col items-center text-center">
      <PapaAvatar
        avatarClass="h-24 w-24"
        mood="warm"
        ringClass="ring-4 ring-white shadow-md"
      />
      <p className="mt-5 text-sm font-medium uppercase tracking-wide text-[#138A3C]">A note from Papa</p>
      <h1
        className="mt-2 text-[40px] leading-[1.05] sm:text-[52px]"
        style={{ fontFamily: SCRIPT_FAMILY, color: SCRIPT_GREEN }}
      >
        Hi Bacche!
      </h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-[#4B5563]">
        Five minutes. You have spent longer deciding what to watch on Netflix.
      </p>
      <div className="mt-6 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-3">
        <WelcomePill icon="⏱️" label="5 minutes" />
        <WelcomePill icon="💾" label="Auto-saved" />
        <WelcomePill icon="☕" label="Pause anytime" />
      </div>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#E9F4EC] px-4 py-1.5 text-xs font-semibold text-[#138A3C]">
        <Sparkles className="h-3 w-3" /> Tap Begin to start
      </div>
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
