"use client";

import { useEffect, useRef, useState } from "react";
import { api, LlmEnhancementStatusResponse } from "@/lib/api";

type ItemType = "recommendation" | "market" | "asset";

export function useLlmEnhancementPolling(itemType: ItemType, active: boolean, refetch: () => Promise<void>) {
  const [status, setStatus] = useState<LlmEnhancementStatusResponse | null>(null);
  const [tick, setTick] = useState(0);
  const polls = useRef(0);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!active) {
      polls.current = 0;
      return;
    }
    if (polls.current >= 120) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      polls.current += 1;
      try {
        const nextStatus = await api.llmEnhancementStatus(itemType);
        if (cancelled) return;
        setStatus(nextStatus);
        await refetchRef.current();
        if (!cancelled && nextStatus.pending > 0) setTick((current) => current + 1);
      } catch {
        // Deterministic card content remains visible if status polling fails.
      }
    }, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, itemType, tick]);

  return status;
}
