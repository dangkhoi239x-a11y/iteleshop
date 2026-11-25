import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bot,
  Coins,
  CreditCard,
  Gift,
  LayoutDashboard,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, Section, StatCard, StatusPill, errMsg } from "@/components/app/ui-bits";
import { retryOrderFulfillment, adminOverview, adminResolveDispute, adminSaveTier, adminShopStatus, adminWithdrawal } from "@/functions/admin.functions";
import { tiersQuery } from "@/lib/queries";
import { money, shortDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLists } from "@/components/app/AdminLists";
import { RewardsManager } from "@/components/app/RewardsManager";
import { PaymentSettings } from "@/components/app/PaymentSettings";
import { RevenueReport, useFinanceText, useRevenueText } from "@/components/app/RevenueReport";
import { StarsSettlement } from "@/components/app/StarsSettlement";
import { TelegramAdmin } from "@/components/app/TelegramAdmin";
import { WithdrawalPolicy } from "@/components/app/WithdrawalPolicy";
import { GrowthManager } from "@/components/app/GrowthManager";
import { useGrowthText } from "@/lib/growth-text";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin · TeleShop" },
      { name: "description", content: "TeleShop platform administration." },
      { property: "og:title", content: "Admin · TeleShop" },
      { property: "og:description", content: "Administration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const growth = useGrowthText();
  const finance = useFinanceText();
  const revenueLabels = useRevenueText();
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const overview = useServerFn(adminOverview);
  const retry = useServerFn(retryOrderFulfillment);
  const wd = useServerFn(adminWithdrawal);
  const resolve = useServerFn(adminResolveDispute);
  const shopStatus = useServerFn(adminShopStatus);
  const saveTier = useServerFn(adminSaveTier);
  const { data, error, isLoading, isFetching, refetch } = useQuery({ queryKey: ["admin"], queryFn: () => overview(), enabled: isAdmin });
  const { data: tiers = [] } = useQuery(tiersQuery());
  const [hash, setHash] = useState<Record<string, string>>({});
  const [tier, setTier] = useState({ min: "", max: "", pct: "" });
  const [shopSearch, setShopSearch] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return <EmptyState icon={ShieldCheck} title="403" sub="Admins only" />;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast.success(t("common.saved"));
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const pendingCount = (data?.issues.length ?? 0) + (data?.withdrawals.length ?? 0) + (data?.disputes.length ?? 0);
  const filteredShops = (data?.shops ?? []).filter((s) => !shopSearch.trim() || s.name.toLowerCase().includes(shopSearch.trim().toLowerCase()));

  const tabs = [
    { value: "overview", label: t("extra.tabOverview"), icon: LayoutDashboard, badge: pendingCount },
    { value: "orders", label: t("extra.tabOrders"), icon: ShoppingBag },
    { value: "products", label: t("extra.tabProducts"), icon: Package },
    { value: "users", label: t("extra.tabUsers"), icon: Users },
    { value: "payments", label: t("extra.tabPayments"), icon: CreditCard },
    { value: "revenue", label: finance.title, icon: BarChart3 },
    { value: "rewards", label: t("extra.tabRewards"), icon: Gift },
    { value: "growth", label: growth.title, icon: Sparkles },
    { value: "telegram", label: "Telegram", icon: Bot },
  ] as const;

  return (
    <div className="min-w-0 pb-8">
      <PageHeader
        title={t("admin.title")}
        action={
          <Button variant="ghost" size="icon" onClick={() => void refetch()} disabled={isFetching} aria-label="Refresh">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        }
      />
      {error && <p role="alert" className="mx-4 mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{errMsg(error)}</p>}

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="sticky top-[57px] z-20 border-b border-border/60 bg-background/95 px-4 py-2.5 backdrop-blur">
          <TabsList className="flex h-auto w-full justify-start gap-1.5 overflow-x-auto bg-transparent p-0">
            {tabs.map(({ value, label, icon: Icon, ...rest }) => {
              const badge = "badge" in rest ? rest.badge : 0;
              return (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="shrink-0 gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                  {badge > 0 && (
                    <span className="rounded-full bg-warning px-1.5 py-0.2 text-[10px] font-bold text-warning-foreground">
                      {badge}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <div className="px-4">
          <TabsContent value="users" className="mt-0"><AdminLists kind="users" /></TabsContent>
          <TabsContent value="telegram" className="mt-0"><TelegramAdmin /></TabsContent>
          <TabsContent value="growth" className="mt-0"><GrowthManager /></TabsContent>
          <TabsContent value="orders" className="mt-0"><AdminLists kind="orders" /></TabsContent>
          <TabsContent value="products" className="mt-0"><AdminLists kind="products" /></TabsContent>
          <TabsContent value="rewards" className="-mx-4 mt-0"><RewardsManager shopId={null} /></TabsContent>
          <TabsContent value="payments" className="mt-0 space-y-6"><PaymentSettings /><WithdrawalPolicy /><StarsSettlement /></TabsContent>
          <TabsContent value="revenue" className="mt-0 space-y-4">
            <div className="flex justify-end">
              <Button asChild variant="outline" size="sm">
                <Link to="/revenue">{revenueLabels.open} <ArrowUpRight className="h-4 w-4" /></Link>
              </Button>
            </div>
            <RevenueReport admin />
          </TabsContent>

          <TabsContent value="overview" className="mt-0 space-y-6">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
              </div>
            ) : (
              <>
                {pendingCount > 0 && (
                  <div className="flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-3.5 text-sm">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">Cần xử lý ({pendingCount})</p>
                      <p className="text-xs text-muted-foreground">
                        {data?.issues.length ?? 0} đơn lỗi mã · {data?.withdrawals.length ?? 0} rút tiền · {data?.disputes.length ?? 0} khiếu nại
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <StatCard label={t("admin.users")} value={data?.users ?? "–"} icon={Users} />
                  <StatCard label={t("admin.orders")} value={data?.orders ?? "–"} icon={ShoppingBag} tone="success" />
                  <StatCard
                    label={t("admin.volume")}
                    value={
                      <div className="space-y-0.5 text-sm">
                        {Object.entries(data?.volume ?? {}).length ? Object.entries(data?.volume ?? {}).map(([c, v]) => <p key={c}>{money(v, c)}</p>) : "0"}
                      </div>
                    }
                    icon={Coins}
                    tone="accent"
                  />
                  <StatCard
                    label={t("admin.fees")}
                    value={
                      <div className="space-y-0.5 text-sm">
                        {Object.entries(data?.fees ?? {}).length ? Object.entries(data?.fees ?? {}).map(([c, v]) => <p key={c}>{money(v, c)}</p>) : "0"}
                      </div>
                    }
                    icon={Coins}
                    tone="warning"
                  />
                </div>
              </>
            )}

            {!!data?.issues.length && (
              <Section title={`Đơn cần xử lý (${data.issues.length})`}>
                <div className="space-y-2">
                  {data.issues.map((o) => (
                    <div key={o.id} className="space-y-2 rounded-2xl border border-warning/40 bg-card p-3.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Link to="/orders/$orderId" params={{ orderId: o.id }} className="truncate font-semibold text-primary hover:underline">
                          #{o.order_number} · {o.product_name}
                        </Link>
                        <StatusPill status="pending" label={o.stars_refund_state === "pending" ? "Stars" : "Shortage"} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {o.stars_refund_state === "pending" ? "Hoàn Stars đang chờ xác nhận; thử lại trong tranh chấp" : "Đã thanh toán nhưng đang chờ bổ sung mã"}
                      </p>
                      {o.fulfillment_state === "shortage" && (
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => retry({ data: { id: o.id } }))}>
                          Thử giao mã lại
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section
              title={t("admin.withdrawals")}
              action={<span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{data?.withdrawals.length ?? 0}</span>}
            >
              {data?.withdrawals.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{t("admin.empty")}</div>
              ) : (
                <div className="space-y-2.5">
                  {data?.withdrawals.map((w) => (
                    <div key={w.id} className="space-y-2.5 rounded-2xl border border-border bg-card p-3.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 tabular font-bold text-primary">
                          <Wallet className="h-4 w-4" />
                          {money(-Number(w.amount), w.currency)}
                        </span>
                        <span className="text-xs text-muted-foreground">{shortDate(w.created_at)}</span>
                      </div>
                      <p className="break-all rounded-lg bg-secondary/60 px-2.5 py-1.5 font-mono text-xs">{w.to_address}</p>
                      <Input
                        className="h-9 text-xs"
                        placeholder={t("admin.txHash")}
                        value={hash[w.id] ?? ""}
                        onChange={(e) => setHash({ ...hash, [w.id]: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" disabled={busy} onClick={() => void run(() => wd({ data: { id: w.id, approve: true, txHash: hash[w.id] } }))}>
                          {t("admin.approve")}
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => wd({ data: { id: w.id, approve: false } }))}>
                          {t("admin.reject")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title={t("admin.disputes")}
              action={<span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{data?.disputes.length ?? 0}</span>}
            >
              {data?.disputes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{t("admin.empty")}</div>
              ) : (
                <div className="space-y-2.5">
                  {data?.disputes.map((d) => (
                    <div key={d.id} className="space-y-2.5 rounded-2xl border border-destructive/40 bg-card p-3.5 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">#{d.orders?.order_number} · {d.orders?.product_name}</p>
                        <span className="shrink-0 tabular text-xs font-bold text-primary">{money(d.orders?.total_amount, d.orders?.currency)}</span>
                      </div>
                      <p className="inline-block rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        {t(`dispute.reasons.${d.reason}`, d.reason)}
                      </p>
                      <p className="whitespace-pre-line text-xs text-muted-foreground">{d.buyer_note}</p>
                      {d.seller_note && <p className="rounded-lg bg-secondary p-2.5 text-xs">{d.seller_note}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" className="flex-1" disabled={busy} onClick={() => void run(() => resolve({ data: { id: d.id, outcome: "refund" } }))}>
                          {t("admin.refund")}
                        </Button>
                        <Button size="sm" className="flex-1" disabled={busy} onClick={() => void run(() => resolve({ data: { id: d.id, outcome: "release" } }))}>
                          {t("admin.release")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title={t("admin.tiers")}>
              <div className="space-y-2.5 rounded-2xl border border-border bg-card p-3.5">
                {tiers.map((x) => (
                  <div key={x.id} className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2 text-sm">
                    <span className="tabular text-xs">{money(x.min_order_amount)} – {x.max_order_amount == null ? "∞" : money(x.max_order_amount)}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">{Number(x.commission_percent)}%</span>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" disabled={busy} onClick={() => void run(() => saveTier({ data: { id: x.id, min_order_amount: 0, max_order_amount: null, commission_percent: 0, remove: true } }))}>
                        {t("common.delete")}
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Input placeholder={t("admin.from")} type="number" value={tier.min} onChange={(e) => setTier({ ...tier, min: e.target.value })} />
                  <Input placeholder={t("admin.to")} type="number" value={tier.max} onChange={(e) => setTier({ ...tier, max: e.target.value })} />
                  <Input placeholder="%" type="number" value={tier.pct} onChange={(e) => setTier({ ...tier, pct: e.target.value })} />
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={busy || !tier.pct}
                  onClick={() => void run(() => saveTier({ data: { min_order_amount: Number(tier.min) || 0, max_order_amount: tier.max ? Number(tier.max) : null, commission_percent: Number(tier.pct) } }))}
                >
                  {t("admin.addTier")}
                </Button>
              </div>
            </Section>

            <Section
              title={t("admin.shops")}
              action={<span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{filteredShops.length}</span>}
            >
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={shopSearch} onChange={(e) => setShopSearch(e.target.value)} placeholder={t("extra.search")} className="pl-9" />
              </div>
              <div className="space-y-2">
                {filteredShops.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3 text-sm">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <span className="rounded-lg bg-primary/10 p-1.5 text-primary"><Store className="h-4 w-4" /></span>
                      <span className="truncate font-medium">{s.name}</span>
                    </div>
                    <StatusPill status={s.status === "active" ? "completed" : "rejected"} label={s.status} />
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => shopStatus({ data: { id: s.id, status: s.status === "active" ? "suspended" : "active" } }))}>
                      {s.status === "active" ? t("admin.suspend") : t("admin.activate")}
                    </Button>
                  </div>
                ))}
              </div>
            </Section>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
