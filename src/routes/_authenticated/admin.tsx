import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Coins, ShoppingBag, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, Section, StatCard, StatusPill, errMsg } from "@/components/app/ui-bits";
import { adminOverview, adminResolveDispute, adminSaveTier, adminShopStatus, adminWithdrawal } from "@/functions/admin.functions";
import { tiersQuery } from "@/lib/queries";
import { money, shortDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLists } from "@/components/app/AdminLists";
import { RewardsManager } from "@/components/app/RewardsManager";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin · TeleShop" }, { name: "description", content: "TeleShop platform administration." }, { property: "og:title", content: "Admin · TeleShop" }, { property: "og:description", content: "Administration." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Admin,
});

function Admin() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const overview = useServerFn(adminOverview);
  const wd = useServerFn(adminWithdrawal);
  const resolve = useServerFn(adminResolveDispute);
  const shopStatus = useServerFn(adminShopStatus);
  const saveTier = useServerFn(adminSaveTier);
  const { data } = useQuery({ queryKey: ["admin"], queryFn: () => overview(), enabled: isAdmin });
  const { data: tiers = [] } = useQuery(tiersQuery());
  const [hash, setHash] = useState<Record<string, string>>({});
  const [tier, setTier] = useState({ min: "", max: "", pct: "" });

  if (!isAdmin) return <EmptyState title="403" sub="Admins only" />;
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(t("common.saved"));
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader title={t("admin.title")} />
      <Tabs defaultValue="overview" className="p-4">
        <TabsList className="flex h-auto w-full flex-wrap">
          <TabsTrigger value="overview">{t("extra.tabOverview")}</TabsTrigger>
          <TabsTrigger value="users">{t("extra.tabUsers")}</TabsTrigger>
          <TabsTrigger value="orders">{t("extra.tabOrders")}</TabsTrigger>
          <TabsTrigger value="products">{t("extra.tabProducts")}</TabsTrigger>
          <TabsTrigger value="rewards">{t("extra.tabRewards")}</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><AdminLists kind="users" /></TabsContent>
        <TabsContent value="orders"><AdminLists kind="orders" /></TabsContent>
        <TabsContent value="products"><AdminLists kind="products" /></TabsContent>
        <TabsContent value="rewards" className="-mx-4"><RewardsManager shopId={null} /></TabsContent>
        <TabsContent value="overview" className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label={t("admin.users")} value={data?.users ?? "–"} icon={Users} />
          <StatCard label={t("admin.orders")} value={data?.orders ?? "–"} icon={ShoppingBag} tone="success" />
          <StatCard label={`${t("admin.volume")}`} value={<span className="text-sm">{Object.entries(data?.volume ?? {}).map(([c, v]) => money(v, c)).join(" · ") || "0"}</span>} icon={Coins} tone="accent" />
          <StatCard label={`${t("admin.fees")}`} value={<span className="text-sm">{Object.entries(data?.fees ?? {}).map(([c, v]) => money(v, c)).join(" · ") || "0"}</span>} icon={Coins} tone="warning" />
        </div>

        <Section title={t("admin.withdrawals")}>
          {data?.withdrawals.length === 0 && <p className="text-sm text-muted-foreground">{t("admin.empty")}</p>}
          {data?.withdrawals.map((w) => (
            <div key={w.id} className="space-y-2 rounded-2xl border border-border bg-card p-3 text-sm">
              <div className="flex justify-between"><span className="tabular font-bold">{money(-Number(w.amount), w.currency)}</span><span className="text-xs text-muted-foreground">{shortDate(w.created_at)}</span></div>
              <p className="break-all font-mono text-xs">{w.to_address}</p>
              <Input className="h-9 text-xs" placeholder={t("admin.txHash")} value={hash[w.id] ?? ""} onChange={(e) => setHash({ ...hash, [w.id]: e.target.value })} />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => run(() => wd({ data: { id: w.id, approve: true, txHash: hash[w.id] } }))}>{t("admin.approve")}</Button>
                <Button size="sm" variant="outline" onClick={() => run(() => wd({ data: { id: w.id, approve: false } }))}>{t("admin.reject")}</Button>
              </div>
            </div>
          ))}
        </Section>

        <Section title={t("admin.disputes")}>
          {data?.disputes.length === 0 && <p className="text-sm text-muted-foreground">{t("admin.empty")}</p>}
          {data?.disputes.map((d) => (
            <div key={d.id} className="space-y-2 rounded-2xl border border-destructive/40 bg-card p-3 text-sm">
              <p className="font-medium">#{d.orders?.order_number} · {d.orders?.product_name} · {money(d.orders?.total_amount, d.orders?.currency)}</p>
              <p className="text-xs">{t(`dispute.reasons.${d.reason}`, d.reason)}</p>
              <p className="whitespace-pre-line text-xs text-muted-foreground">{d.buyer_note}</p>
              {d.seller_note && <p className="rounded-lg bg-secondary p-2 text-xs">{d.seller_note}</p>}
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" className="flex-1" onClick={() => run(() => resolve({ data: { id: d.id, outcome: "refund" } }))}>{t("admin.refund")}</Button>
                <Button size="sm" className="flex-1" onClick={() => run(() => resolve({ data: { id: d.id, outcome: "release" } }))}>{t("admin.release")}</Button>
              </div>
            </div>
          ))}
        </Section>

        <Section title={t("admin.tiers")}>
          <div className="space-y-2">
            {tiers.map((x) => (
              <div key={x.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
                <span className="tabular">{money(x.min_order_amount)} – {x.max_order_amount == null ? "∞" : money(x.max_order_amount)}</span>
                <span className="font-bold text-primary">{Number(x.commission_percent)}%</span>
                <Button size="sm" variant="ghost" onClick={() => run(() => saveTier({ data: { id: x.id, min_order_amount: 0, max_order_amount: null, commission_percent: 0, remove: true } }))}>{t("common.delete")}</Button>
              </div>
            ))}
            <div className="grid grid-cols-4 gap-2">
              <Input placeholder={t("admin.from")} type="number" value={tier.min} onChange={(e) => setTier({ ...tier, min: e.target.value })} />
              <Input placeholder={t("admin.to")} type="number" value={tier.max} onChange={(e) => setTier({ ...tier, max: e.target.value })} />
              <Input placeholder="%" type="number" value={tier.pct} onChange={(e) => setTier({ ...tier, pct: e.target.value })} />
              <Button onClick={() => run(() => saveTier({ data: { min_order_amount: Number(tier.min) || 0, max_order_amount: tier.max ? Number(tier.max) : null, commission_percent: Number(tier.pct) } }))} disabled={!tier.pct}>{t("admin.addTier")}</Button>
            </div>
          </div>
        </Section>

        <Section title={t("admin.shops")}>
          {data?.shops.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-sm">
              <span className="flex-1 truncate">{s.name}</span>
              <StatusPill status={s.status === "active" ? "completed" : "rejected"} label={s.status} />
              <Button size="sm" variant="outline" onClick={() => run(() => shopStatus({ data: { id: s.id, status: s.status === "active" ? "suspended" : "active" } }))}>{s.status === "active" ? t("admin.suspend") : t("admin.activate")}</Button>
            </div>
          ))}
        </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
