import type { TextareaHTMLAttributes } from "react";

import { cn } from "../../lib/utils.js";

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-36 w-full rounded-2xl border border-input bg-white/85 px-4 py-3 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground/70 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
        className,
      )}
      {...props}
    />
  );
}
