"use client";

import { Sparkles } from "lucide-react";
import { Confetti } from "../_components/confetti";
import { PapaAvatar } from "../_components/papa-bubble";
import { SCRIPT_FAMILY, SCRIPT_GREEN } from "@/lib/fonts";
import { ScreenContext } from "../_flow/types";

export function CelebrateScreen({ values }: ScreenContext) {
  const firstName = (values.name || "").trim().split(/\s+/)[0] || "";
  return (
    <div className="relative">
      <Confetti />
      <div className="relative flex flex-col items-center text-center">
        <PapaAvatar
          avatarClass="h-24 w-24"
          mood="celebrate"
          ringClass="ring-4 ring-white shadow-md"
        />
        <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#138A3C]">
          <Sparkles className="h-3 w-3" /> All set
        </p>
        <h1
          className="mt-2 text-[40px] leading-[1.05] sm:text-[52px]"
          style={{ fontFamily: SCRIPT_FAMILY, color: SCRIPT_GREEN }}
        >
          That&apos;s My Kid!
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-[#4B5563]">
          There{firstName ? `, ${firstName}` : ""}. A proper plan. Now try not to ignore it for six months.
        </p>
        <div className="mt-6 grid w-full max-w-md grid-cols-3 gap-3">
          <Pill icon="📊" label="Your dashboard" />
          <Pill icon="🎯" label="Goal progress" />
          <Pill icon="💡" label="Smart picks" />
        </div>
      </div>
    </div>
  );
}

function Pill({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium text-[#0F172A] shadow-sm">
      <span aria-hidden>{icon}</span>
      {label}
    </div>
  );
}
