import { cn } from "@/lib/utils";
import { CATEGORY_MAP } from "@/lib/sample-data";
import type { CategoryId } from "@/lib/types";

export function CategoryBadge({
  id,
  className,
  showDot = true,
}: {
  id: CategoryId;
  className?: string;
  showDot?: boolean;
}) {
  const c = CATEGORY_MAP[id];
  if (!c) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        c.badge,
        className
      )}
    >
      {showDot && <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />}
      {c.label}
    </span>
  );
}
