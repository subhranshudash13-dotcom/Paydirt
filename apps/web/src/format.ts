export const money = (n?: number | null): string =>
  n == null ? "—" : `$${n.toLocaleString("en-US")}`;

export const pct = (n?: number | null): string => (n == null ? "—" : `${Math.round(n * 100)}%`);

export const perHour = (n?: number | null): string => (n == null ? "—" : `$${n.toFixed(2)}/hr`);

export const days = (n?: number | null): string => (n == null ? "—" : `${n.toFixed(0)}d`);

export function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400_000);
  if (d > 0) return `${d}d ago`;
  const h = Math.floor(diff / 3600_000);
  return h > 0 ? `${h}h ago` : "just now";
}

export const STATUS_COLORS: Record<string, string> = {
  CLAIMED: "bg-sky-500/15 text-sky-300",
  WORKING: "bg-indigo-500/15 text-indigo-300",
  PR_OPEN: "bg-amber-500/15 text-amber-300",
  IN_REVIEW: "bg-amber-500/15 text-amber-300",
  MERGED: "bg-emerald-500/15 text-emerald-300",
  PAYOUT_PENDING: "bg-gold-500/15 text-gold-400",
  PAID: "bg-emerald-500/20 text-emerald-300",
  ABANDONED: "bg-rose-500/15 text-rose-300",
};
