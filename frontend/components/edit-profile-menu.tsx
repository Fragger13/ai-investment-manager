"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SECTIONS } from "@/app/onboarding/_flow/types";

// Sections a user can jump straight into. "Welcome" and the celebrate screen
// aren't editable data, so they're left out of the menu.
const EDITABLE = SECTIONS.filter((section) => section.id !== "welcome" && section.id !== "celebrate");

/** The dashboard "Edit profile" control: a dropdown that either reopens the
 *  whole flow from the top, or deep-links straight to a single section. */
export function EditProfileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open}>
        <Pencil className="h-4 w-4" /> Edit profile
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-lg"
        >
          <Link
            role="menuitem"
            href="/onboarding?mode=edit"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-hover focus:outline-none focus-visible:bg-surface-hover"
          >
            Everything, from the top
          </Link>
          <div className="my-1 h-px bg-border" aria-hidden />
          <p className="px-3 pb-1 pt-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">Jump to a section</p>
          {EDITABLE.map((section) => (
            <Link
              key={section.id}
              role="menuitem"
              href={`/onboarding?mode=edit&section=${section.id}`}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface-hover hover:text-foreground focus:outline-none focus-visible:bg-surface-hover focus-visible:text-foreground"
            >
              {section.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
