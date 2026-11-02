import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { Flame, Gift, Package, Settings, ShoppingBag, Store, Tag, Truck, TrendingUp } from "lucide-react";
import { PageHeader, Section, StatCard } from "@/components/app/ui-bits";
import { ShopGate, type ShopRow } from "@/components/app/ShopGate";
import { shopOrdersQuery } from "@/lib/queries";
import { money } from "@/lib/format";
import { useFinanceText } from "@/components/app/RevenueReport";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Merchant dashboard · TeleShop" }, { name: "description", content: "Revenue, orders and tools for your TeleShop store." }, { property: "og:title", content: "Merchant dashboard · TeleShop" }, { property: "og:description", content: "Manage your shop." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: () => <ShopGate>{(shop) => <Dashboard shop={shop} />}</ShopGate>,
});

function Dashboard({ shop }: { shop: ShopRow }) {
  const finance = useFinanceText();
  const { t } = useTranslation();
  const { data: orders = [] } = useQuery(shopOrdersQuery(shop.id));
  const done = orders.filter((o) => o.status === "completed");
  const revenue = (cur: string) => done.reduce((s,o)=>s+(o.pay_method==='stars' ? o.settled_currency===cur ? Number(o.settled_net??0) : 0 : o.currency===cur ? Number(o.total_amount)-Number(o.commission_amount)-(o.affiliate_user_id?Number(o.total_amount)*Number(o.affiliate_percent)/100:0) : 0),0);
  const toShip = orders.filter((o) => o.status === "paid").length;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { day: d.toLocaleDateString(undefined, { weekday: "narrow" }), v: done.filter((o) => (o.completed_at ?? "").slice(0, 10) === key && (o.pay_method==='stars'?o.settled_currency:o.currency)==='USDT').reduce((s, o) => s + (o.pay_method==='stars'?Number(o.settled_net??0):Number(o.total_amount)-Number(o.commission_amount)-(o.affiliate_user_id?Number(o.total_amount)*Number(o.affiliate_percent)/100:0)), 0) };
  });
  const actions = [
    { to: "/dashboard/revenue", icon: TrendingUp, label: finance.title },
    { to: '/dashboard/settlements', icon: TrendingUp, label: 'Đối soát Stars' },
    { to: '/withdrawals', icon: Truck, label: 'Lịch sử rút tiền' },
    { to: "/dashboard/products", icon: Package, label: t("dash.products") },
    { to: "/dashboard/orders", icon: Truck, label: t("dash.orders") },
    { to: "/dashboard/flash-sales", icon: Flame, label: t("dash.flash") },
    { to: "/dashboard/vouchers", icon: Tag, label: t("dash.vouchers") },
    { to: "/dashboard/rewards", icon: Gift, label: t("rewards.manage") },
    { to: "/dashboard/settings", icon: Settings, label: t("dash.settings") },
  ] as const;

  return (
    <div>
      <PageHeader title={shop.name} action={<Link to="/shop/$shopId" params={{ shopId: shop.id }} className="text-sm text-primary"><Store className="h-5 w-5" /></Link>} />
      <div className="space-y-5 p-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label={`${t("dash.revenue")} · USDT`} value={money(revenue("USDT"))} icon={TrendingUp} />
          <StatCard label={`${t("dash.revenue")} · TON`} value={money(revenue("TON"))} icon={TrendingUp} tone="accent" />
          <StatCard label={t("dash.ordersCount")} value={orders.length} icon={ShoppingBag} tone="success" />
          <StatCard label={t("dash.toShip")} value={toShip} icon={Truck} tone="warning" />
        </div>
        <Section title={`${t("dash.last7")} · USDT`}>
          <div className="h-36 rounded-2xl border border-border bg-card p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days}><XAxis dataKey="day" axisLine={false} tickLine={false} fontSize={11} stroke="var(--muted-foreground)" /><Bar dataKey="v" fill="var(--primary)" radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <div className="grid grid-cols-3 gap-2">
          {actions.map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 text-center text-xs font-medium">
              <span className="rounded-xl bg-primary/10 p-2"><Icon className="h-5 w-5 text-primary" /></span>{label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
