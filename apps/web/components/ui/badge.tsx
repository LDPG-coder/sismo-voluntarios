import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-emerald-600 text-slate-50 dark:bg-emerald-500 dark:text-white",
        secondary:
          "border-slate-200 bg-[#eaebed] text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300",
        outline: "border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300",
        warning:
          "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        destructive:
          "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
