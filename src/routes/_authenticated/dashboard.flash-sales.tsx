import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Countdown, EmptyState, Field, PageHeader, errMsg } from "@/components/app/ui-bits";
import { ShopGate, type ShopRow } from "@/components/app/ShopGate";
import { myProductsQuery } from "@/lib/queries";
import { isFlashSaleActive } from "@/lib/pricing";
import { money } from "@/lib/format";
import { setFlashSale } from "@/server/market.functions";

export const Route = createFileRoute("/_authenticated/dashboard/flash-sales")({
  head: () => ({ meta: [{ title: "Flash sales · TeleShop" }, { name: "description", content: "Run time-limited discounts on your products." }, { property: "og:title", content: "Flash sales · TeleShop" }, { property: "og:description", content: "Run flash sales." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <ShopGate>{(shop) => <Flash shop={shop} />}</ShopGate>,
});

function Flash({ shop }: { shop: ShopRow }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data = [] } = useQuery(myProductsQuery(shop.id));
  const save = useServerFn(setFlashSale);
  const [form, setForm] = useState<Record<string, { price: string; end: string }>>({});

  const apply = async (id: string, clear = false) => {
    const v = form[id];
    try {
      await save({ data: clear ? { id, flash_sale_price: null, flash_sale_end: null } : { id, flash_sale_price: Number(v?.price), flash_sale_end: new Date(v?.end ?? "").toISOString() } });
      toast.success(t("common.saved"));
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader title={t("flash.title")} />
      <div className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">{t("flash.sub")}</p>
        {data.length === 0 && <EmptyState title={t("products.empty")} />}
        {data.map((p) => {
          const live = isFlashSaleActive(p);
          const v = form[p.id] ?? { price: "", end: "" };
          return (
            <div key={p.id} className="space-y-3 rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-medium">{p.name}</p>
                  <p className="tabular text-xs text-muted-foreground">{money(p.price, p.currency)}</p>
                </div>
                {live && <span className="rounded-full bg-flash px-2 py-0.5 text-[11px] font-bold text-flash-foreground">{money(p.flash_sale_price)} · <Countdown end={p.flash_sale_end!} /></span>}
              </div>
              {live ? (
                <Button variant="outline" size="sm" className="w-full" onClick={() => apply(p.id, true)}>{t("flash.clear")}</Button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("flash.price")}><Input type="number" inputMode="decimal" value={v.price} onChange={(e) => setForm({ ...form, [p.id]: { ...v, price: e.target.value } })} /></Field>
                  <Field label={t("flash.end")}><Input type="datetime-local" value={v.end} onChange={(e) => setForm({ ...form, [p.id]: { ...v, end: e.target.value } })} /></Field>
                  <Button size="sm" className="col-span-2" disabled={!(Number(v.price) > 0) || !v.end} onClick={() => apply(p.id)}>{t("flash.set")}</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
