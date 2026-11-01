export function money(v: number | string | null | undefined, currency?: string) {
  const n = Number(v ?? 0);
  const s = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: n !== 0 && Math.abs(n) < 1 ? 4 : 2 });
  return currency ? `${s} ${currency}` : s;
}

export function shortDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function countdown(endIso: string, now = Date.now()) {
  const ms = Math.max(0, new Date(endIso).getTime() - now);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function displayName(p: { first_name?: string | null; last_name?: string | null; username?: string | null } | null) {
  if (!p) return "";
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || (p.username ? `@${p.username}` : "User");
}
