"use client";

import { SCRIPT_FAMILY, SCRIPT_GREEN } from "@/lib/fonts";

export type PapaMood =
  | "warm"
  | "curious"
  | "thoughtful"
  | "caring"
  | "blessed"
  | "concerned"
  | "proud"
  | "gentle"
  | "laugh"
  | "loving"
  | "celebrate";

const MOOD_IMAGE: Record<PapaMood, string> = {
  warm: "/landing/papa-warm.png",
  curious: "/landing/papa-curious.png",
  thoughtful: "/landing/papa-thoughtful.png",
  caring: "/landing/papa-caring.png",
  blessed: "/landing/papa-blessed.png",
  concerned: "/landing/papa-concerned.png",
  proud: "/landing/papa-proud.png",
  gentle: "/landing/papa-gentle.png",
  laugh: "/landing/papa-laugh.png",
  loving: "/landing/papa-loving.png",
  celebrate: "/landing/papa-celebrate.png"
};

type PapaBubbleProps = {
  message: string;
  size?: "sm" | "md" | "lg";
  hideAvatar?: boolean;
  mood?: PapaMood;
  className?: string;
  textClassName?: string;
};

const sizeMap = {
  sm: { avatar: "h-14 w-14", text: "text-[1.375rem]", pad: "px-5 py-3" },
  md: { avatar: "h-20 w-20", text: "text-[1.75rem] sm:text-[2rem]", pad: "px-6 py-4" },
  lg: { avatar: "h-28 w-28", text: "text-[2.125rem] sm:text-[2.5rem]", pad: "px-7 py-5" }
};

export function PapaBubble({ message, size = "md", hideAvatar = false, mood = "warm", className = "", textClassName }: PapaBubbleProps) {
  const sizing = sizeMap[size];
  return (
    <div className={`flex items-start gap-4 sm:gap-5 ${className}`}>
      {hideAvatar ? null : <PapaAvatar avatarClass={sizing.avatar} mood={mood} ringClass="" />}
      <div className={`relative flex-1 rounded-2xl border border-[#E5E7EB] bg-white shadow-md ${sizing.pad}`}>
        <span
          className="absolute -left-1.5 top-6 h-3 w-3 rotate-45 border-b border-l border-[#E5E7EB] bg-white"
          aria-hidden
        />
        <p className={`${textClassName || sizing.text} font-medium leading-snug`} style={{ fontFamily: SCRIPT_FAMILY, color: SCRIPT_GREEN }}>
          {message}
        </p>
      </div>
    </div>
  );
}

export function PapaAvatar({
  avatarClass,
  mood = "warm",
  ringClass = ""
}: {
  avatarClass: string;
  mood?: PapaMood;
  ringClass?: string;
}) {
  const src = MOOD_IMAGE[mood];
  return (
    <div className={`relative ${avatarClass} shrink-0`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt=""
        aria-hidden
        className={`h-full w-full rounded-full bg-white object-cover ${ringClass} transition-opacity duration-300`}
      />
    </div>
  );
}
