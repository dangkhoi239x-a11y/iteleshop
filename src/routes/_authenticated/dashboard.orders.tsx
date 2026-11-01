import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader, StatusPill, errMsg } from "@/components/app/ui-bits";
import { ShopGate, type ShopRow } from "@/components/app/ShopGate";
import { shopOrdersQuery } from "@/lib/queries";
import { money, shortDate } from "@/lib/format";
import { updateOrder } from "@/functions/orders.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard/orders")({
  head: () => ({ meta: [{ title: "Order management · TeleShop" }, { name: "description", content: "Ship and track your shop's orders." }, { property: "og:title", content: "Order management · TeleShop" }, { property: "og:description", content: "Manage orders." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <ShopGate>{(shop) => <Manage shop={shop} />}</ShopGate>,
});

const FILTERS = { all: () => true, toShip: (s: string) => s === "paid", shipped: (s: string) => s === "shipped" || s === "delivered", done: (s: string) => ["completed", "refunded", "disputed"].includes(s) };

function Manage({ shop }: { shop: ShopRow }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data = [] } = useQuery(shopOrdersQuery(shop.id));
  const reports = useQuery({ queryKey: ["shopCodeReports",shop.id], queryFn: async () => {
    const r = await supabase.from("code_issues").select("id,order_id,description,orders!inner(shop_id,order_number,product_name)").eq("orders.shop_id",shop.id).in("status",["open","reviewing"]).order("created_at");
    if (r.error) throw new Error(r.error.message);
    return r.data;
  } });
  const update = useServerFn(updateOrder);
  const [tab, setTab] = useState<keyof typeof FILTERS>("toShip");
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = data.filter((o) => FILTERS[tab](o.status) && (!needle || String(o.order_number).includes(needle) || o.product_name.toLowerCase().includes(needle)));

  const act = async (orderId: string, action: "ship" | "deliver") => {
    try {
      await update({ data: { orderId, action, tracking: tracking[orderId] } });
      await qc.invalidateQueries({ queryKey: ["shopOrders"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader title={t("manage.title")} />
      <div className="space-y-3 p-4">
        {!!reports.data?.length && <section className="space-y-2 border-b border-border pb-4"><h2 className="font-semibold text-warning">{t("codeIssue.pending")} ({reports.data.length})</h2>{reports.data.map(r=><Link key={r.id} to="/orders/$orderId" params={{orderId:r.order_id}} className="block rounded-lg border border-warning/40 p-3 text-sm"><p className="font-medium">#{r.orders.order_number} · {r.orders.product_name}</p><p className="line-clamp-2 text-muted-foreground">{r.description}</p></Link>)}</section>}
        <Tabs value={tab} onValueChange={(v) => setTab(v as keyof typeof FILTERS)}>
          <TabsList className="grid w-full grid-cols-4">{(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((k) => <TabsTrigger key={k} value={k} className="text-xs">{t(`manage.tabs.${k}`)}</TabsTrigger>)}</TabsList>
        </Tabs>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("manage.searchPh")} className="pl-9" />
        </div>
        {list.length === 0 && <EmptyState icon={Truck} title={t("manage.empty")} />}
        {list.map((o) => (
          <div key={o.id} className="space-y-2 rounded-2xl border border-border bg-card p-3">
            <Link to="/orders/$orderId" params={{ orderId: o.id }} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t("order.number", { n: o.order_number })} · {shortDate(o.created_at)}</p>
                <p className="line-clamp-1 text-sm font-medium">{o.product_name} × {o.quantity}</p>
                <p className="tabular text-sm font-bold text-primary">{money(o.total_amount, o.currency)}</p>
              </div>
              <StatusPill status={o.status} label={t(`order.status.${o.status}`)} />
            </Link>
            {o.delivery_address && <p className="rounded-lg bg-secondary px-2 py-1.5 text-xs">{o.delivery_address}</p>}
            {o.status === "paid" && (
              <div className="flex gap-2">
                <Input className="h-9 text-xs" placeholder={t("manage.trackingPh")} value={tracking[o.id] ?? ""} onChange={(e) => setTracking({ ...tracking, [o.id]: e.target.value })} />
                <Button size="sm" onClick={() => act(o.id, "ship")}>{t("manage.ship")}</Button>
              </div>
            )}
            {o.status === "shipped" && <Button size="sm" variant="secondary" className="w-full" onClick={() => act(o.id, "deliver")}>{t("manage.deliver")}</Button>}
          </div>
        ))}
      </div>
    </div>
  );
}
