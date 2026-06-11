"use client";

import { Badge } from "@/components/ui/badge";

type RecommendationTagsProps = {
  tags: string[];
  renderKey: string;
};

export function RecommendationTags({ tags, renderKey }: RecommendationTagsProps) {
  if (!tags.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {tags.map((tag) => <RecommendationTag key={`${renderKey}-tag-${stableTextKey(tag)}`} tag={tag} />)}
    </div>
  );
}

export function RecommendationTag({ tag }: { tag: string }) {
  if (tag.startsWith("P") && tag.endsWith("Goal")) {
    return (
      <Badge className="border-violet-400/30 bg-violet-100 text-violet-800 shadow-sm dark:bg-violet-500/15 dark:text-violet-200" tone="neutral">
        {tag}
      </Badge>
    );
  }
  return <Badge tone={tagTone(tag)}>{friendlyTag(tag)}</Badge>;
}

function tagTone(tag: string): "good" | "warn" | "danger" | "neutral" {
  if (tag === "High Conviction" || tag === "Strong Opportunity") return "good";
  if (tag === "Medium Conviction" || tag === "Worth Considering") return "warn";
  if (tag === "Crypto" || tag === "Low Conviction" || tag === "Needs More Review") return "danger";
  return "neutral";
}

function friendlyTag(tag: string) {
  if (tag.startsWith("Evidence ")) return tag.replace("Evidence ", "Supporting Signals ");
  if (tag === "High Conviction") return "Strong Opportunity";
  if (tag === "Medium Conviction") return "Worth Considering";
  if (tag === "Low Conviction") return "Needs More Review";
  return tag;
}

function stableTextKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "item";
}
