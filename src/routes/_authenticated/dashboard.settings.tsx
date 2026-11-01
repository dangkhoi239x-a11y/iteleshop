import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, PageHeader, Section, errMsg } from "@/components/app/ui-bits";
import { ShopGate, type BotRow, type ShopRow } from "@/components/app/ShopGate";
import { testShopBot, updateShop, updateShopBot } from "@/functions/market.functions";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  head: () => ({ meta: [{ title: "Shop settings · TeleShop" }, { name: "description", content: "Shop profile, payout wallet and Telegram bot notifications." }, { property: "og:title", content: "Shop settings · TeleShop" }, { property: "og:description", content: "Shop settings." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <ShopGate>{(shop, bot) => <Settings shop={shop} bot={bot} />}</ShopGate>,
});

function Settings({ shop, bot }: { shop: ShopRow; bot: BotRow | null }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const save = useServerFn(updateShop);
  const saveBot = useServerFn(updateShopBot);
  const test = useServerFn(testShopBot);
  const [f, setF] = useState({ name: shop.name, description: shop.description ?? "", category: shop.category ?? "", logo_url: shop.logo_url ?? "", banner_url: shop.banner_url ?? "", telegram_channel: shop.telegram_channel ?? "", wallet_address: shop.wallet_address ?? "", affiliate_percent: String(Number(shop.affiliate_percent)) });
  const [b, setB] = useState({ bot_token: bot?.bot_token ?? "", notification_chat_id: bot?.notification_chat_id ?? "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const wrap = async (fn: () => Promise<unknown>, ok = t("common.saved")) => {
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader title={t("settings.title")} />
      <div className="space-y-6 p-4">
        <Section title={t("settings.shopInfo")}>
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <Field label={t("shop.name")}><Input value={f.name} onChange={set("name")} /></Field>
            <Field label={t("shop.desc")}><Textarea value={f.description} onChange={set("description")} rows={3} /></Field>
            <Field label={t("shop.category")}><Input value={f.category} onChange={set("category")} /></Field>
            <Field label={t("shop.logo")}><Input value={f.logo_url} onChange={set("logo_url")} placeholder="https://…" /></Field>
            <Field label={t("shop.banner")}><Input value={f.banner_url} onChange={set("banner_url")} placeholder="https://…" /></Field>
            <Field label={t("shop.telegramChannel")}><Input value={f.telegram_channel} onChange={set("telegram_channel")} /></Field>
            <Field label={t("shop.wallet")}><Input value={f.wallet_address} onChange={set("wallet_address")} /></Field>
            <Field label={t("settings.affiliatePercent")}><Input type="number" min={0} max={50} value={f.affiliate_percent} onChange={set("affiliate_percent")} /></Field>
            <Button className="w-full" onClick={() => wrap(() => save({ data: { ...f, affiliate_percent: Number(f.affiliate_percent) } }))}>{t("common.save")}</Button>
          </div>
        </Section>
        <Section title={t("settings.bot")}>
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="flex gap-2 text-xs text-muted-foreground"><Bot className="h-4 w-4 shrink-0 text-primary" />{t("settings.botHelp")}</p>
            <Field label={t("settings.botToken")}><Input type="password" value={b.bot_token} onChange={(e) => setB({ ...b, bot_token: e.target.value })} placeholder="123456:ABC…" /></Field>
            <Field label={t("settings.chatId")}><Input value={b.notification_chat_id} onChange={(e) => setB({ ...b, notification_chat_id: e.target.value })} placeholder="-100…" /></Field>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => wrap(() => saveBot({ data: b }))}>{t("common.save")}</Button>
              <Button variant="secondary" onClick={() => wrap(() => test(), t("settings.testOk"))}>{t("settings.test")}</Button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
