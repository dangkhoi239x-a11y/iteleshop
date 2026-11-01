import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, PageHeader, errMsg } from "@/components/app/ui-bits";
import { createShop } from "@/functions/market.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/register-shop")({
  head: () => ({ meta: [{ title: "Open a shop · TeleShop" }, { name: "description", content: "Open your crypto shop on TeleShop in a minute." }, { property: "og:title", content: "Open a shop · TeleShop" }, { property: "og:description", content: "Sell for USDT and TON." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: RegisterShop,
});

const PLANS = ["starter", "pro", "enterprise"] as const;

function RegisterShop() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createShop);
  const [f, setF] = useState({ name: "", description: "", category: "", telegram_channel: "", wallet_address: "", logo_url: "" });
  const [plan, setPlan] = useState<(typeof PLANS)[number]>("starter");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    setBusy(true);
    try {
      await create({ data: { ...f, plan } });
      await qc.invalidateQueries();
      toast.success(t("common.saved"));
      await nav({ to: "/dashboard" });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title={t("shop.register")} />
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">{t("shop.registerSub")}</p>
        <Field label={t("shop.name")}><Input value={f.name} onChange={set("name")} maxLength={60} /></Field>
        <Field label={t("shop.desc")}><Textarea value={f.description} onChange={set("description")} rows={3} maxLength={1000} /></Field>
        <Field label={t("shop.category")}><Input value={f.category} onChange={set("category")} placeholder="Digital, Gaming, Fashion…" maxLength={40} /></Field>
        <Field label={t("shop.logo")}><Input value={f.logo_url} onChange={set("logo_url")} placeholder="https://…" /></Field>
        <Field label={t("shop.telegramChannel")}><Input value={f.telegram_channel} onChange={set("telegram_channel")} placeholder="@mychannel" /></Field>
        <Field label={t("shop.wallet")}><Input value={f.wallet_address} onChange={set("wallet_address")} placeholder="UQ… / T…" /></Field>
        <Field label={t("shop.plan")}>
          <div className="grid grid-cols-3 gap-2">
            {PLANS.map((p) => (
              <button key={p} type="button" onClick={() => setPlan(p)} className={cn("rounded-xl border p-3 text-sm font-medium", plan === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-card")}>{t(`shop.plans.${p}`)}</button>
            ))}
          </div>
        </Field>
        <Button size="lg" className="w-full" onClick={submit} disabled={busy || f.name.trim().length < 2}>{t("shop.create")}</Button>
      </div>
    </div>
  );
}
