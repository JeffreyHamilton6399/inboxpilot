"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";

export function TimeAgo({
  iso,
  className,
}: {
  iso: string;
  className?: string;
}) {
  const date = new Date(iso);
  const label = formatDistanceToNowStrict(date, { addSuffix: true });
  return (
    <span className={cn("tabular-nums whitespace-nowrap", className)}>
      {label}
    </span>
  );
}
