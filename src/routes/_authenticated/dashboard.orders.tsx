import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader, StatusPill, errMsg } from "@/components/app/ui-bits";
import { ShopGate, type ShopRow } from "@/components/app/ShopGate";
import { shopOrdersQuery } from "@/lib/queries";
import { money, shortDate } from "@/lib/format";
import { updateOrder } from "@/server/orders.functions";

export const Route = createFileRoute("/_authenticated/dashboard/orders")({
  head: () => ({ meta: [{ title: "Order management · TeleShop" }, { name: "description", content: "Ship and track your shop's orders." }, { property: "og:title", content: "Order management · TeleShop" }, { property: "og:description", content: "Manage orders." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <ShopGate>{(shop) => <Manage shop={shop} />}</ShopGate>,
});

const FILTERS = { all: () => true, toShip: (s: string) => s === "paid", shipped: (s: string) => s === "shipped" || s === "delivered", done: (s: string) => ["completed", "refunded", "disputed"].includes(s) };

function Manage({ shop }: { shop: ShopRow }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data = [] } = useQuery(shopOrdersQuery(shop.id));
  const update = useServerFn(updateOrder);
  const [tab, setTab] = useState<keyof typeof FILTERS>("toShip");
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const list = data.filter((o) => FILTERS[tab](o.status));

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
        <Tabs value={tab} onValueChange={(v) => setTab(v as keyof typeof FILTERS)}>
          <TabsList className="grid w-full grid-cols-4">{(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((k) => <TabsTrigger key={k} value={k} className="text-xs">{t(`manage.tabs.${k}`)}</TabsTrigger>)}</TabsList>
        </Tabs>
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
