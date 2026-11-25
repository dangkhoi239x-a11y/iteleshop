import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, Package, Search, Shield, ShoppingBag, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, StatusPill, errMsg } from "@/components/app/ui-bits";
import { adminLists, adminProductStatus, adminSetAdmin } from "@/functions/admin.functions";
import { money, shortDate } from "@/lib/format";

export function AdminLists({ kind }: { kind: "users" | "orders" | "products" }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [pages, setPages] = useState(1);
  const list = useServerFn(adminLists);
  const setStatus = useServerFn(adminProductStatus);
  const setAdmin = useServerFn(adminSetAdmin);
  const { data, isLoading, error } = useQuery({ queryKey: ["adminList", kind, q, pages], queryFn: () => list({ data: { kind, q, pages } }) });

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(t("common.saved"));
      await qc.invalidateQueries({ queryKey: ["adminList"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const totalCount = (data?.users.length ?? 0) + (data?.orders.length ?? 0) + (data?.products.length ?? 0);
  const emptyIcon = kind === "users" ? Users : kind === "orders" ? ShoppingBag : Package;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPages(1);
          }}
          placeholder={t("extra.search")}
          className="bg-card pl-9"
        />
      </div>

      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{errMsg(error)}</p>}

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      )}

      {!isLoading && !error && totalCount === 0 && <EmptyState icon={emptyIcon} title={t("admin.empty")} />}

      {data?.users.map((u) => {
        const display = u.first_name || u.username || "—";
        return (
          <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary">
              {display.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate font-medium">{display}{u.username ? ` @${u.username}` : ""}</p>
                {u.isAdmin && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    <Shield className="h-2.5 w-2.5" /> Admin
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">TG {u.telegram_id} · {shortDate(u.created_at)}</p>
            </div>
            <Button
              size="sm"
              variant={u.isAdmin ? "outline" : "secondary"}
              onClick={() => void run(() => setAdmin({ data: { userId: u.id, admin: !u.isAdmin } }))}
            >
              {u.isAdmin ? t("extra.removeAdmin") : t("extra.makeAdmin")}
            </Button>
          </div>
        );
      })}

      {data?.orders.map((o) => (
        <Link key={o.id} to="/orders/$orderId" params={{ orderId: o.id }} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm transition-colors hover:border-primary/50">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">#{o.order_number} · {o.product_name}</p>
            <p className="text-[11px] text-muted-foreground">{o.shops?.name} · {shortDate(o.created_at)}</p>
          </div>
          <div className="shrink-0 text-right space-y-1">
            <p className="tabular text-xs font-bold text-primary">{money(o.total_amount, o.currency)}</p>
            <StatusPill status={o.status} label={t(`order.status.${o.status}`, o.status)} />
          </div>
        </Link>
      ))}

      {data?.products.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-medium">{p.name}</p>
              {p.status === "suspended" && <StatusPill status="rejected" label="Hidden" />}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {p.shops?.name} · <span className="tabular font-semibold text-foreground">{money(p.price, p.currency)}</span> · {t("products.stock")} {p.stock} · {t("product.sold", { n: p.sold_count })}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void run(() => setStatus({ data: { id: p.id, status: p.status === "suspended" ? "active" : "suspended" } }))}
          >
            {p.status === "suspended" ? <><Eye className="h-3.5 w-3.5" /> {t("extra.show")}</> : <><EyeOff className="h-3.5 w-3.5" /> {t("extra.hide")}</>}
          </Button>
        </div>
      ))}

      {data && totalCount === pages * 100 && (
        <Button variant="outline" className="w-full" onClick={() => setPages((n) => n + 1)}>
          Tải thêm
        </Button>
      )}
    </div>
  );
}
