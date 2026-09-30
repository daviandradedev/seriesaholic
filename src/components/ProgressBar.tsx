import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
  complete,
}: {
  value: number;
  className?: string;
  complete?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, value));
  const done = complete ?? pct >= 100;

  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/10", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          done
            ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
            : "bg-gradient-to-r from-violet-500 to-fuchsia-500",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
