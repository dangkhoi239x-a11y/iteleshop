import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill, errMsg } from "@/components/app/ui-bits";
import { adminLists, adminProductStatus, adminSetAdmin } from "@/functions/admin.functions";
import { money, shortDate } from "@/lib/format";

export function AdminLists({ kind }: { kind: "users" | "orders" | "products" }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [pages,setPages]=useState(1);
  const list = useServerFn(adminLists);
  const setStatus = useServerFn(adminProductStatus);
  const setAdmin = useServerFn(adminSetAdmin);
  const { data, isLoading, error } = useQuery({ queryKey: ["adminList", kind, q, pages], queryFn: () => list({ data: { kind, q, pages } }) });
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); toast.success(t("common.saved")); await qc.invalidateQueries({ queryKey: ["adminList"] }); } catch (e) { toast.error(errMsg(e)); } };
  const row = "flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm";
  return (
    <div className="space-y-2">
      <Input value={q} onChange={(e) => {setQ(e.target.value);setPages(1)}} placeholder={t("extra.search")} />
      {error&&<p role="alert" className="text-destructive">{errMsg(error)}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {data?.users.map((u) => (
        <div key={u.id} className={row}>
          <div className="min-w-0 flex-1"><p className="truncate font-medium">{u.first_name || u.username || "—"}{u.username ? ` @${u.username}` : ""}</p><p className="text-[11px] text-muted-foreground">TG {u.telegram_id} · {shortDate(u.created_at)}</p></div>
          <Button size="sm" variant={u.isAdmin ? "outline" : "secondary"} onClick={() => run(() => setAdmin({ data: { userId: u.id, admin: !u.isAdmin } }))}>{u.isAdmin ? t("extra.removeAdmin") : t("extra.makeAdmin")}</Button>
        </div>
      ))}
      {data?.orders.map((o) => (
        <Link key={o.id} to="/orders/$orderId" params={{ orderId: o.id }} className={row}>
          <div className="min-w-0 flex-1"><p className="truncate font-medium">#{o.order_number} · {o.product_name}</p><p className="text-[11px] text-muted-foreground">{o.shops?.name} · {shortDate(o.created_at)}</p></div>
          <span className="tabular text-xs">{money(o.total_amount, o.currency)}</span>
          <StatusPill status={o.status} label={t(`order.status.${o.status}`, o.status)} />
        </Link>
      ))}
      {data?.products.map((p) => (
        <div key={p.id} className={row}>
          <div className="min-w-0 flex-1"><p className="truncate font-medium">{p.name}</p><p className="text-[11px] text-muted-foreground">{p.shops?.name} · {money(p.price, p.currency)} · {p.stock} / {p.sold_count}</p></div>
          <Button size="sm" variant="outline" onClick={() => run(() => setStatus({ data: { id: p.id, status: p.status === "suspended" ? "active" : "suspended" } }))}>{p.status === "suspended" ? t("extra.show") : t("extra.hide")}</Button>
        </div>
      ))}
      {data&&(data.users.length+data.orders.length+data.products.length)===pages*100&&<Button variant="outline" className="w-full" onClick={()=>setPages(n=>n+1)}>Tải thêm</Button>}
    </div>
  );
}
