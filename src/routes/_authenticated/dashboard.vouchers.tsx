import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Field, PageHeader, Section, errMsg } from "@/components/app/ui-bits";
import { ShopGate, type ShopRow } from "@/components/app/ShopGate";
import { vouchersQuery } from "@/lib/queries";
import { money, shortDate } from "@/lib/format";
import { saveVoucher, toggleVoucher } from "@/server/market.functions";

export const Route = createFileRoute("/_authenticated/dashboard/vouchers")({
  head: () => ({ meta: [{ title: "Vouchers · TeleShop" }, { name: "description", content: "Create discount codes for your shop." }, { property: "og:title", content: "Vouchers · TeleShop" }, { property: "og:description", content: "Create vouchers." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <ShopGate>{(shop) => <Vouchers shop={shop} />}</ShopGate>,
});

function Vouchers({ shop }: { shop: ShopRow }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data = [] } = useQuery(vouchersQuery(shop.id));
  const save = useServerFn(saveVoucher);
  const toggle = useServerFn(toggleVoucher);
  const [f, setF] = useState({ code: "", type: "percent" as "percent" | "fixed", value: "", min: "", max: "", expires: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const refresh = () => qc.invalidateQueries({ queryKey: ["vouchers"] });

  const submit = async () => {
    try {
      await save({ data: { code: f.code, discount_type: f.type, discount_value: Number(f.value), min_order_amount: f.min ? Number(f.min) : null, max_uses: f.max ? Number(f.max) : null, expires_at: f.expires ? new Date(f.expires).toISOString() : null } });
      toast.success(t("common.saved"));
      setF({ code: "", type: "percent", value: "", min: "", max: "", expires: "" });
      await refresh();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader title={t("voucher.title")} />
      <div className="space-y-5 p-4">
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("voucher.code")}><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="SALE10" maxLength={20} /></Field>
            <Field label={t("voucher.type")}>
              <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as "percent" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percent">{t("voucher.percent")}</SelectItem><SelectItem value="fixed">{t("voucher.fixed")}</SelectItem></SelectContent></Select>
            </Field>
            <Field label={t("voucher.value")}><Input type="number" value={f.value} onChange={set("value")} /></Field>
            <Field label={t("voucher.minOrder")}><Input type="number" value={f.min} onChange={set("min")} placeholder={t("common.optional")} /></Field>
            <Field label={t("voucher.maxUses")}><Input type="number" value={f.max} onChange={set("max")} placeholder={t("common.optional")} /></Field>
            <Field label={t("voucher.expires")}><Input type="datetime-local" value={f.expires} onChange={set("expires")} /></Field>
          </div>
          <Button className="w-full" onClick={submit} disabled={f.code.length < 3 || !(Number(f.value) > 0)}>{t("voucher.create")}</Button>
        </div>
        <Section>
          {data.length === 0 && <EmptyState icon={Tag} title={t("voucher.empty")} />}
          <div className="space-y-2">
            {data.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-primary/50 bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-bold text-primary">{v.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.discount_type === "percent" ? `−${Number(v.discount_value)}%` : `−${money(v.discount_value)}`}
                    {v.min_order_amount ? ` · ≥ ${money(v.min_order_amount)}` : ""} · {t("voucher.used", { used: v.used_count, max: v.max_uses ?? t("voucher.unlimited") })}
                    {v.expires_at ? ` · ${shortDate(v.expires_at)}` : ""}
                  </p>
                </div>
                <Switch checked={v.is_active} onCheckedChange={async (c) => { await toggle({ data: { id: v.id, is_active: c } }); await refresh(); }} />
                <Button variant="ghost" size="icon" onClick={async () => { await toggle({ data: { id: v.id, remove: true } }); await refresh(); }}><Trash2 className="text-destructive" /></Button>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
