import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, errMsg } from "@/components/app/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { adminRegisterWebhook, adminSaveSettings } from "@/functions/admin.functions";
import { useFinanceText } from './RevenueReport';

export function PaymentSettings() {
  const finance = useFinanceText();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const save = useServerFn(adminSaveSettings);
  const reg = useServerFn(adminRegisterWebhook);
  const { data } = useQuery({ queryKey: ["platformSettings"], queryFn: async () => (await supabase.from("platform_settings").select("*").maybeSingle()).data });
  const [f, setF] = useState({ stars_enabled: false, crypto_enabled: true, stars_per_usdt: "77", stars_per_ton: "250" });
  useEffect(() => { if (data) setF({ stars_enabled: data.stars_enabled, crypto_enabled: data.crypto_enabled, stars_per_usdt: String(Number(data.stars_per_usdt)), stars_per_ton: String(Number(data.stars_per_ton)) }); }, [data]);
  const submit = async () => {
    try { await save({ data: { ...f, stars_per_usdt: Number(f.stars_per_usdt), stars_per_ton: Number(f.stars_per_ton) } }); toast.success(t("common.saved")); await qc.invalidateQueries({ queryKey: ["platformSettings"] }); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{finance.quote}</p>
      <label className="flex items-center justify-between text-sm">{t("extra.starsOn")}<Switch checked={f.stars_enabled} onCheckedChange={(c) => setF({ ...f, stars_enabled: c })} /></label>
      <label className="flex items-center justify-between text-sm">{t("extra.cryptoOn")}<Switch checked={f.crypto_enabled} onCheckedChange={(c) => setF({ ...f, crypto_enabled: c })} /></label>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("extra.starsUsdt")}><Input type="number" value={f.stars_per_usdt} onChange={(e) => setF({ ...f, stars_per_usdt: e.target.value })} /></Field>
        <Field label={t("extra.starsTon")}><Input type="number" value={f.stars_per_ton} onChange={(e) => setF({ ...f, stars_per_ton: e.target.value })} /></Field>
      </div>
      <Button className="w-full" onClick={submit}>{t("common.save")}</Button>
      <Button variant="outline" className="w-full" onClick={async () => { try { const r = await reg(); toast.success(r.url); } catch (e) { toast.error(errMsg(e)); } }}>{t("extra.regWebhook")}</Button>
    </div>
  );
}
