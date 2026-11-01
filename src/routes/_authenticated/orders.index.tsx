import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader, StatusPill } from "@/components/app/ui-bits";
import { myOrdersQuery } from "@/lib/queries";
import { money, shortDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({ meta: [{ title: "My orders · TeleShop" }, { name: "description", content: "Track your crypto orders and escrow status." }, { property: "og:title", content: "My orders · TeleShop" }, { property: "og:description", content: "Track your orders." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Orders,
});

function Orders() {
  const { t } = useTranslation();
  const { userId } = useAuth();
  const { data, isLoading } = useQuery({ ...myOrdersQuery(userId ?? ""), enabled: !!userId });
  return (
    <div>
      <PageHeader title={t("order.title")} back={false} />
      <div className="space-y-2 p-4">
        {isLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        {data?.length === 0 && <EmptyState icon={ListOrdered} title={t("order.empty")} sub={t("order.emptySub")} action={<Button asChild><Link to="/">{t("order.startShopping")}</Link></Button>} />}
        {data?.map((o) => (
          <Link key={o.id} to="/orders/$orderId" params={{ orderId: o.id }} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">{o.product_image && <img src={o.product_image} alt="" className="h-full w-full object-cover" />}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">{t("order.number", { n: o.order_number })} · {shortDate(o.created_at)}</p>
                <StatusPill status={o.status} label={t(`order.status.${o.status}`)} />
              </div>
              <p className="mt-1 line-clamp-1 text-sm font-medium">{o.product_name} × {o.quantity}</p>
              <p className="tabular text-sm font-bold text-primary">{money(o.total_amount, o.currency)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
