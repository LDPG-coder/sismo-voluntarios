import * as React from "react";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-zinc-200/70 dark:bg-zinc-700/50",
        className,
      )}
      {...props}
    >
      <div className="absolute inset-0 skeleton-shimmer" />
    </div>
  );
}
