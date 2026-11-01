import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, PageHeader, errMsg } from "@/components/app/ui-bits";
import { joinAffiliate } from "@/server/market.functions";

export const Route = createFileRoute("/_authenticated/kol-onboarding")({
  head: () => ({ meta: [{ title: "KOL program · TeleShop" }, { name: "description", content: "Apply as a KOL and promote TeleShop products for commission." }, { property: "og:title", content: "KOL program · TeleShop" }, { property: "og:description", content: "Apply as KOL." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Kol,
});

function Kol() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const join = useServerFn(joinAffiliate);
  const [f, setF] = useState({ channel_url: "", audience: "", niche: "" });
  const [tier, setTier] = useState<string | null>(null);

  const submit = async () => {
    try {
      const r = await join({ data: { kol: true, channel_url: f.channel_url, audience_size: Number(f.audience) || 0, niche: f.niche } });
      setTier(r.tier);
      await qc.invalidateQueries({ queryKey: ["affiliate"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader title={t("kol.title")} />
      <div className="space-y-4 p-4">
        <div className="rounded-3xl border border-border bg-hero p-5">
          <Megaphone className="mb-3 h-7 w-7 text-accent" />
          <p className="text-sm text-muted-foreground">{t("kol.sub")}</p>
        </div>
        {tier ? (
          <p className="rounded-2xl bg-success/15 p-4 text-center font-medium text-success">{t("kol.done", { tier })}</p>
        ) : (
          <>
            <Field label={t("kol.channel")}><Input value={f.channel_url} onChange={(e) => setF({ ...f, channel_url: e.target.value })} placeholder="https://t.me/…" /></Field>
            <Field label={t("kol.audience")}><Input type="number" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} /></Field>
            <Field label={t("kol.niche")}><Input value={f.niche} onChange={(e) => setF({ ...f, niche: e.target.value })} maxLength={60} /></Field>
            <Button className="w-full" size="lg" onClick={submit} disabled={f.channel_url.length < 5}>{t("kol.submit")}</Button>
          </>
        )}
      </div>
    </div>
  );
}
