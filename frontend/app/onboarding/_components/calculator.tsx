"use client";

import { useEffect, useRef, useState } from "react";
import { Calculator as CalcIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEYPAD: { label: string; kind: "digit" | "op" | "fn" | "eq"; span?: "col-span-2" }[] = [
  { label: "C", kind: "fn" },
  { label: "⌫", kind: "fn" },
  { label: "%", kind: "op" },
  { label: "÷", kind: "op" },
  { label: "7", kind: "digit" },
  { label: "8", kind: "digit" },
  { label: "9", kind: "digit" },
  { label: "×", kind: "op" },
  { label: "4", kind: "digit" },
  { label: "5", kind: "digit" },
  { label: "6", kind: "digit" },
  { label: "-", kind: "op" },
  { label: "1", kind: "digit" },
  { label: "2", kind: "digit" },
  { label: "3", kind: "digit" },
  { label: "+", kind: "op" },
  { label: "0", kind: "digit", span: "col-span-2" },
  { label: ".", kind: "digit" },
  { label: "=", kind: "eq" }
];

function evalExpression(expr: string): string {
  const normalized = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
  if (!normalized) return "";
  if (!/^[\d+\-*/.()%]*$/.test(normalized)) return "Error";
  const withPercent = normalized.replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${withPercent});`)();
    if (typeof result !== "number" || !isFinite(result)) return "Error";
    return String(Math.round(result * 1e8) / 1e8);
  } catch {
    return "Error";
  }
}

export function CalculatorButton() {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState("");
  const [result, setResult] = useState("");
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    setResult(evalExpression(display));
  }, [display]);

  const press = (key: typeof KEYPAD[number]) => {
    if (key.label === "C") {
      setDisplay("");
    } else if (key.label === "⌫") {
      setDisplay((d) => d.slice(0, -1));
    } else if (key.label === "=") {
      const r = evalExpression(display);
      if (r && r !== "Error") setDisplay(r);
    } else {
      setDisplay((d) => d + key.label);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Button type="button" variant="outline" size="lg" onClick={() => setOpen((o) => !o)} aria-label="Open calculator">
        <CalcIcon className="h-5 w-5" /> Calculator
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-xl">
          <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3">
            <input
              type="text"
              value={display}
              onChange={(e) => setDisplay(e.target.value)}
              placeholder="0"
              aria-label="Calculator expression"
              className="w-full bg-transparent text-right text-xl font-semibold text-[#0F172A] placeholder:text-[#9CA3AF] focus:outline-none"
            />
            <p className="mt-1 min-h-[18px] text-right text-sm text-[#138A3C]">
              {result && result !== display ? `= ${result}` : ""}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {KEYPAD.map((key) => (
              <button
                key={key.label}
                type="button"
                onClick={() => press(key)}
                className={`${key.span || ""} h-10 rounded-lg text-base font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#138A3C] ${
                  key.kind === "eq"
                    ? "bg-[#138A3C] text-white hover:bg-[#107132]"
                    : key.kind === "op" || key.kind === "fn"
                    ? "bg-[#F8FAF9] text-[#138A3C] hover:bg-[#E9F4EC]"
                    : "border border-[#E5E7EB] bg-white text-[#0F172A] hover:bg-[#FAFAFA]"
                }`}
              >
                {key.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
