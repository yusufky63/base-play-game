export function StatusDot({ tone = "online" }: { tone?: "online" | "pending" | "muted" }) {
  const color = tone === "online" ? "bg-[var(--win)]" : tone === "pending" ? "bg-[var(--pending)]" : "bg-[var(--text-3)]";

  return <span className={`h-2 w-2 rounded-full ${color}`} aria-hidden="true" />;
}
