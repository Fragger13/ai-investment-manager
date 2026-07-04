"use client";

type ProgressSegmentsProps = {
  sections: { id: string; label: string }[];
  activeIndex: number;
};

export function ProgressSegments({ sections, activeIndex }: ProgressSegmentsProps) {
  return (
    <div className="flex w-full gap-2">
      {sections.map((section, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        return (
          <div key={section.id} className="flex-1">
            <div
              className={`h-2 rounded-full transition-all ${
                done ? "bg-[#138A3C]" : active ? "bg-[#138A3C]" : "bg-[#E5E7EB]"
              }`}
            />
            <p
              className={`mt-2 hidden text-[0.75rem] font-semibold uppercase tracking-wider sm:block ${
                active ? "text-[#138A3C]" : done ? "text-[#138A3C]/70" : "text-[#9CA3AF]"
              }`}
            >
              {section.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}
